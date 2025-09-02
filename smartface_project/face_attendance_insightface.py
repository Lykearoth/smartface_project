import insightface
import cv2
import numpy as np
import os
from datetime import datetime
import sqlite3
import socketio
import asyncio
import platform
import sys
from werkzeug.security import generate_password_hash
import base64
import pytz
import time

# Initialize InsightFace model with lightweight settings
try:
    model = insightface.app.FaceAnalysis(name='buffalo_l', providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
except AttributeError:
    model = insightface.app.FaceAnalysis(name='buffalo_l')
model.prepare(ctx_id=0, det_size=(320, 320))

# Configuration
DATASET_DIR = "dataset"
USER_DIR = os.path.join(DATASET_DIR, "users")
EMPLOYEE_DIR = os.path.join(DATASET_DIR, "employees")
KNOWN_EMBEDDINGS_DIR = "known_embeddings"
USER_EMBEDDINGS_DIR = os.path.join(KNOWN_EMBEDDINGS_DIR, "users")
EMPLOYEE_EMBEDDINGS_DIR = os.path.join(KNOWN_EMBEDDINGS_DIR, "employees")
SIMILARITY_THRESHOLD = 0.45
FRAME_SKIP = 2
COOLDOWN_SECONDS = 10

# Initialize SocketIO
sio = socketio.Client()

# SocketIO event handlers
@sio.event
def connect():
    print("Connected to Flask server")

@sio.event
def disconnect():
    print("Disconnected from Flask server")

@sio.on('attendance_error')
def handle_attendance_error(data):
    print(f"Attendance error: {data['message']}")

# Initialize database
def init_db():
    conn = sqlite3.connect('attendance.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        name TEXT,
        email TEXT,
        is_admin INTEGER DEFAULT 0,
        face_embedding_path TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT,
        face_embedding_path TEXT,
        gender TEXT,
        date_of_birth TEXT,
        department TEXT,
        position TEXT,
        phone_number TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS attendance (
        id TEXT,
        name TEXT,
        timestamp TEXT,
        action TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS face_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        image BLOB,
        encoding TEXT
    )''')
    c.execute("INSERT OR IGNORE INTO users (username, password, is_admin, name, email, role) VALUES (?, ?, ?, ?, ?, ?)",
              ('admin', generate_password_hash('admin123'), 1, 'Admin User', 'admin@example.com', 'admin'))
    conn.commit()
    conn.close()

init_db()

def add_face_embedding_path():
    with sqlite3.connect('attendance.db') as conn:
        c = conn.cursor()
        c.execute("PRAGMA table_info(employees)")
        columns = [col[1] for col in c.fetchall()]
        if 'face_embedding_path' not in columns:
            print("Adding face_embedding_path column to employees table...")
            c.execute("ALTER TABLE employees ADD COLUMN face_embedding_path TEXT")
        if 'gender' not in columns:
            print("Adding gender column to employees table...")
            c.execute("ALTER TABLE employees ADD COLUMN gender TEXT")
        if 'date_of_birth' not in columns:
            print("Adding date_of_birth column to employees table...")
            c.execute("ALTER TABLE employees ADD COLUMN date_of_birth TEXT")
        if 'department' not in columns:
            print("Adding department column to employees table...")
            c.execute("ALTER TABLE employees ADD COLUMN department TEXT")
        if 'position' not in columns:
            print("Adding position column to employees table...")
            c.execute("ALTER TABLE employees ADD COLUMN position TEXT")
        if 'phone_number' not in columns:
            print("Adding phone_number column to employees table...")
            c.execute("ALTER TABLE employees ADD COLUMN phone_number TEXT")
        
        c.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in c.fetchall()]
        if 'name' not in columns:
            print("Adding name column to users table...")
            c.execute("ALTER TABLE users ADD COLUMN name TEXT")
        if 'email' not in columns:
            print("Adding email column to users table...")
            c.execute("ALTER TABLE users ADD COLUMN email TEXT")
        if 'role' not in columns:
            print("Adding role column to users table...")
            c.execute("ALTER TABLE users ADD COLUMN role TEXT")
        
        conn.commit()
        print("Database schema verification completed.")

if __name__ == "__main__":
    add_face_embedding_path()

# Create directories
def ensure_directories():
    for directory in [USER_DIR, EMPLOYEE_DIR, USER_EMBEDDINGS_DIR, EMPLOYEE_EMBEDDINGS_DIR]:
        os.makedirs(directory, exist_ok=True)

ensure_directories()

def get_embedding_path(identifier):
    if identifier.startswith('user:'):
        username = identifier.replace('user:', '')
        return os.path.join(USER_DIR, username), os.path.join(USER_EMBEDDINGS_DIR, f"{username}.npy")
    elif identifier.startswith('employee:'):
        id = identifier.replace('employee:', '')
        return os.path.join(EMPLOYEE_DIR, id), os.path.join(EMPLOYEE_EMBEDDINGS_DIR, f"{id}.npy")
    else:
        return os.path.join(EMPLOYEE_DIR, identifier), os.path.join(EMPLOYEE_EMBEDDINGS_DIR, f"{identifier}.npy")

def register_face(identifier, name):
    person_dir, embedding_path = get_embedding_path(identifier)
    os.makedirs(person_dir, exist_ok=True)
    
    video_capture = cv2.VideoCapture(0)
    if not video_capture.isOpened():
        print("Error: Could not open webcam.")
        return False
    
    print(f"Capturing face for {name} ({identifier}). Press 'q' to capture (5 max), 'e' to cancel.")
    count = 0
    max_images = 5
    embeddings = []
    
    while count < max_images:
        ret, frame = video_capture.read()
        if not ret:
            print("Error: Failed to capture image.")
            break
        
        # Add instruction text and capture counter to the frame
        cv2.putText(frame, "Press 'q' to capture...", (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2, cv2.LINE_AA)
        cv2.putText(frame, f"Captured: {count}/{max_images}", (10, 60), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2, cv2.LINE_AA)
        
        cv2.imshow('Register Face', frame)
        key = cv2.waitKey(1) & 0xFF
        
        if key == ord('q'):
            img_path = os.path.join(person_dir, f"{count}.jpg")
            cv2.imwrite(img_path, frame)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            faces = model.get(rgb_frame)
            if faces:
                embeddings.append(faces[0].embedding)
                print(f"Saved image {count + 1}/{max_images} at {img_path}")
                count += 1
            else:
                print("No face detected in this image.")
        elif key == ord('e'):
            print("Registration cancelled.")
            break
    
    video_capture.release()
    cv2.destroyAllWindows()
    
    if embeddings:
        avg_embedding = np.mean(embeddings, axis=0)
        np.save(embedding_path, avg_embedding)
        conn = sqlite3.connect('attendance.db')
        c = conn.cursor()
        if identifier.startswith('user:'):
            username = identifier.replace('user:', '')
            c.execute("INSERT OR REPLACE INTO users (username, face_embedding_path, name, email, role) VALUES (?, ?, ?, ?, ?)",
                      (username, person_dir, name, None, None))
        else:
            id = identifier.replace('employee:', '') if identifier.startswith('employee:') else identifier
            c.execute("INSERT OR REPLACE INTO employees (id, name, face_embedding_path, gender, date_of_birth, department, position, phone_number) VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL)",
                      (id, name, person_dir))
        conn.commit()
        conn.close()
        extract_embeddings()
        return True
    return False

def extract_embeddings():
    user_embeddings = []
    user_ids = []
    employee_embeddings = []
    employee_ids = []
    
    for username in os.listdir(USER_DIR):
        person_path = os.path.join(USER_DIR, username)
        embedding_path = os.path.join(USER_EMBEDDINGS_DIR, f"{username}.npy")
        if os.path.isdir(person_path):
            conn = sqlite3.connect('attendance.db')
            c = conn.cursor()
            c.execute("SELECT username, name, email, role FROM users WHERE username = ?", (username,))
            user = c.fetchone()
            conn.close()
            if user:
                embeddings = []
                for img_name in os.listdir(person_path):
                    if not img_name.endswith('.jpg'):
                        continue
                    img_path = os.path.join(person_path, img_name)
                    img = cv2.imread(img_path)
                    if img is None:
                        print(f"Warning: Could not read {img_path}")
                        continue
                    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                    faces = model.get(img)
                    if faces:
                        embeddings.append(faces[0].embedding)
                if embeddings:
                    avg_embedding = np.mean(embeddings, axis=0)
                    np.save(embedding_path, avg_embedding)
                    user_embeddings.append(avg_embedding)
                    user_ids.append(f"user:{username}")
    
    for id in os.listdir(EMPLOYEE_DIR):
        person_path = os.path.join(EMPLOYEE_DIR, id)
        embedding_path = os.path.join(EMPLOYEE_EMBEDDINGS_DIR, f"{id}.npy")
        if os.path.isdir(person_path):
            conn = sqlite3.connect('attendance.db')
            c = conn.cursor()
            c.execute("SELECT name, gender, date_of_birth, department, position, phone_number FROM employees WHERE id = ?", (id,))
            employee = c.fetchone()
            conn.close()
            if employee:
                embeddings = []
                for img_name in os.listdir(person_path):
                    if not img_name.endswith('.jpg'):
                        continue
                    img_path = os.path.join(person_path, img_name)
                    img = cv2.imread(img_path)
                    if img is None:
                        print(f"Warning: Could not read {img_path}")
                        continue
                    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                    faces = model.get(img)
                    if faces:
                        embeddings.append(faces[0].embedding)
                if embeddings:
                    avg_embedding = np.mean(embeddings, axis=0)
                    np.save(embedding_path, avg_embedding)
                    employee_embeddings.append(avg_embedding)
                    employee_ids.append(f"employee:{id}")
    
    np.save(os.path.join(KNOWN_EMBEDDINGS_DIR, "user_embeddings.npy"), np.array(user_embeddings))
    np.save(os.path.join(KNOWN_EMBEDDINGS_DIR, "user_ids.npy"), np.array(user_ids))
    np.save(os.path.join(KNOWN_EMBEDDINGS_DIR, "employee_embeddings.npy"), np.array(employee_embeddings))
    np.save(os.path.join(KNOWN_EMBEDDINGS_DIR, "employee_ids.npy"), np.array(employee_ids))
    print(f"Extracted {len(user_embeddings)} user embeddings and {len(employee_embeddings)} employee embeddings.")

def load_known_embeddings(role='employee'):
    embeddings_path = os.path.join(KNOWN_EMBEDDINGS_DIR, f"{role}_embeddings.npy")
    ids_path = os.path.join(KNOWN_EMBEDDINGS_DIR, f"{role}_ids.npy")
    if not (os.path.exists(embeddings_path) and os.path.exists(ids_path)):
        return [], []
    embeddings = np.load(embeddings_path)
    ids = np.load(ids_path)
    return embeddings, ids

def verify_face(identifier):
    _, embedding_path = get_embedding_path(identifier)
    if not os.path.exists(embedding_path):
        print(f"No embedding found for {identifier}")
        return False
    
    target_embedding = np.load(embedding_path)
    video_capture = cv2.VideoCapture(0)
    if not video_capture.isOpened():
        print("Error: Could not open webcam.")
        return False
    
    print(f"Verifying face for {identifier}. Look at the camera.")
    start_time = datetime.now()
    frame_count = 0
    
    while (datetime.now() - start_time).seconds < 5:
        ret, frame = video_capture.read()
        if not ret:
            continue
        
        frame_count += 1
        if frame_count % FRAME_SKIP != 0:
            continue
        
        frame = cv2.resize(frame, (320, 320))
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        faces = model.get(rgb_frame)
        if faces:
            embedding = faces[0].embedding
            similarity = np.dot(embedding, target_embedding) / (np.linalg.norm(embedding) * np.linalg.norm(target_embedding))
            if similarity > SIMILARITY_THRESHOLD:
                video_capture.release()
                cv2.destroyAllWindows()
                print(f"Match found for {identifier} (confidence: {similarity:.2f})")
                return True
        
        cv2.imshow('Verify Face', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    video_capture.release()
    cv2.destroyAllWindows()
    print(f"No match for {identifier}")
    return False

def mark_attendance(id, name, confidence, action):
    tz = pytz.timezone('Asia/Bangkok')
    timestamp = datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")
    
    sio.emit('attendance', {
        'id': id,
        'name': name,
        'timestamp': timestamp,
        'action': action
    })
    print(f"Emitted attendance: {id}, {name}, {timestamp}, {action}")

def recognize_faces():
    embeddings, ids = load_known_embeddings(role='employee')
    if len(embeddings) == 0:
        print("Error: No known employee embeddings found. Run 'Extract embeddings' first.")
        return
    
    video_capture = cv2.VideoCapture(0)
    if not video_capture.isOpened():
        print("Error: Could not open webcam.")
        return
    
    print("Starting attendance recognition. Press 'q' to quit.")
    frame_count = 0
    last_attendance = {}
    
    while True:
        ret, frame = video_capture.read()
        if not ret:
            print("Error: Failed to capture video.")
            break
        
        frame_count += 1
        if frame_count % FRAME_SKIP != 0:
            continue
        
        frame = cv2.resize(frame, (320, 320))
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        faces = model.get(rgb_frame)
        
        face_data = []
        for face in faces:
            embedding = face.embedding
            similarities = np.dot(embeddings, embedding) / (np.linalg.norm(embeddings, axis=1) * np.linalg.norm(embedding))
            best_match_idx = np.argmax(similarities)
            confidence = similarities[best_match_idx]
            
            if confidence > SIMILARITY_THRESHOLD:
                identifier = ids[best_match_idx]
                id = identifier.replace('employee:', '')
                conn = sqlite3.connect('attendance.db')
                c = conn.cursor()
                c.execute("SELECT name FROM employees WHERE id = ?", (id,))
                name = c.fetchone()
                conn.close()
                if name:
                    name = name[0]
                    current_time = time.time()
                    if id not in last_attendance or (current_time - last_attendance[id]) > COOLDOWN_SECONDS:
                        action = 'check-in'
                        mark_attendance(id, name, confidence, action)
                        last_attendance[id] = current_time
                        print(f"Attendance processed for {id} ({name})")
                    else:
                        print(f"Skipping attendance for {id} ({name}): Within cooldown period")
                else:
                    name = "Unknown"
            else:
                name = "Unknown"
            
            bbox = face.bbox.astype(int).tolist()
            face_data.append({
                'bbox': [bbox[0], bbox[1], bbox[2], bbox[3]],
                'name': name,
            })
        
        _, buffer = cv2.imencode('.jpg', frame)
        frame_base64 = base64.b64encode(buffer).decode('utf-8')
        
        sio.emit('video_frame', {
            'frame': frame_base64,
            'faces': face_data
        })
        
        cv2.imshow('Attendance System', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    video_capture.release()
    cv2.destroyAllWindows()

async def main():
    try:
        sio.connect('http://127.0.0.1:5000')
    except Exception as e:
        print(f"WebSocket connection failed: {e}")
        return
    
    if len(sys.argv) > 1:
        mode = sys.argv[1]
        if mode == 'register' and len(sys.argv) >= 4:
            identifier, name = sys.argv[2], sys.argv[3]
            if not (identifier.startswith('user:') or identifier.startswith('employee:')):
                identifier = f"employee:{identifier}" if mode == 'register' and not identifier.startswith('user:') else f"user:{identifier}"
            if register_face(identifier, name):
                print(f"Successfully registered {name} with {identifier}")
            return
        elif mode == 'verify' and len(sys.argv) == 3:
            identifier = sys.argv[2]
            if not (identifier.startswith('user:') or identifier.startswith('employee:')):
                identifier = f"user:{identifier}"
            if verify_face(identifier):
                print(f"Verification successful for {identifier}")
            else:
                print(f"Verification failed for {identifier}")
            return
        elif mode == 'extract':
            extract_embeddings()
            return
        elif mode == 'identify':
            recognize_faces()
            return
    
    while True:
        print("\nFace Attendance System")
        print("1. Register a new face (user or employee)")
        print("2. Extract embeddings from dataset")
        print("3. Start attendance system (employees)")
        print("4. Verify face (authentication)")
        print("5. Exit")
        choice = input("Enter choice (1-5): ")
        
        if choice == '1':
            role = input("Enter role (user/employee): ").lower()
            if role not in ['user', 'employee']:
                print("Error: Role must be 'user' or 'employee'.")
                continue
            id = input(f"Enter {'username' if role == 'user' else 'employee ID'}: ")
            name = input("Enter name: ")
            if id.strip() and name.strip():
                identifier = f"{role}:{id}"
                if register_face(identifier, name):
                    print(f"Registered {name} as {identifier}")
            else:
                print("Error: ID and name cannot be empty.")
        elif choice == '2':
            extract_embeddings()
        elif choice == '3':
            recognize_faces()
        elif choice == '4':
            role = input("Enter role (user/employee): ").lower()
            if role not in ['user', 'employee']:
                print("Error: Role must be 'user' or 'employee'.")
                continue
            id = input(f"Enter {'username' if role == 'user' else 'employee ID'}: ")
            identifier = f"{role}:{id}"
            if verify_face(identifier):
                print(f"Verification successful for {identifier}")
            else:
                print(f"Verification failed for {identifier}")
        elif choice == '5':
            print("Exiting...")
            sio.disconnect()
            break
        else:
            print("Invalid choice. Try again.")

async def async_main():
    await main()

if platform.system() == "Emscripten":
    asyncio.ensure_future(async_main())
else:
    if __name__ == "__main__":
        asyncio.run(async_main())