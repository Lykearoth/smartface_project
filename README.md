# National University of Management
# NUM · Faculty of Information Technology
# Thesis Topic: Smart Face-Based Attendance System

# Supervisor: Asst. Prof. Sreng Vichet
# Team Members: Ly Kearoth · Chan Sambath · Phy Phorn
_Generation 30th, Academic Years 2022–2025._

**Project Configuration Guideline: Smart Face-Based Attendance System** 

_Overview_ 

This Smart Face-Based Attendance System uses InsightFace for face detection (RetinaFace/SCRFD) and recognition (ArcFace). real-time check-in/out, attendance search, Excel export, and a dashboard with real-time updates via SocketIO. The frontend uses Tailwind CSS, Font Awesome, Flatpickr, Chart.js, and SocketIO. 

_Prerequisites_

Hardware: Webcam for face capture.
Operating System: Windows 10/11 (tested), Linux, or macOS.
Python Version: Python 3.8–3.13.
Tools: VS Code (recommended), PowerShell (Windows) or terminal (Linux/macOS).
Internet: Required for InsightFace model download and CDN access.
Windows Build Tools (Windows only): Microsoft Visual C++ 14.0+ for compiling InsightFace.

_Setup Instructions_ 

Step 1: Clone or Copy the Project
Copy the project folder to your machine (e.g., D:\Smart Face-Based Attendance System).

Step 2: Install Microsoft Visual C++ Build Tools (Windows Only)
Download Visual Studio Build Tools.
Select Desktop development with C++, ensure:
MSVC v140 or later (e.g., v142).
Windows 10/11 SDK.
Install (~3–5 GB).

Step 3: Set Up Python Virtual Environment
Open PowerShell (Windows) or terminal (Linux/macOS).
Navigate to the project root: cd "D:\Smart Face-Based Attendance System"
-> Create a virtual environment: python -m venv .venv
-> Activate the virtual environment:
.Windows: & ".\.venv\Scripts\Activate.ps1"
.Linux/macOS: source .venv/bin/activate

Step 4: Install Dependencies (If Needed)
-> Install required Python packages: pip install flask flask-socketio flask-login werkzeug insightface opencv-python numpy pandas pytz openpyxl
-> Update pip (recommended): python -m pip install --upgrade pip
-> Verify installation: pip list | Select-String "flask|flask-socketio|flask-login|werkzeug|insightface|opencv-python|numpy|pandas|pytz|openpyxl"

Step 5: Configure VS Code (Optional)
-> Open the project in VS Code: cd "D:\Smart Face-Based Attendance System\smartface_project"
-> Select the Python interpreter:
-> Ctrl+Shift+P, select Python: Select Interpreter, choose D:\Smart Face-Based Attendance System\.venv\Scripts\python.exe.

Add to .vscode/settings.json:{
    "python.pythonPath": "D:\\Smart Face-Based Attendance System\\.venv\\Scripts\\python.exe",
    "python.analysis.extraPaths": ["D:\\Smart Face-Based Attendance System\\smartface_project"]
}

Step 6: Verify File Paths (If Needed)
Ensure app.py uses relative paths:EMPLOYEE_DIR = 'static/employee_images'
DB_PATH = 'attendance.db'
app.static_folder = 'static'
app.template_folder = 'templates'
Confirm static/images/logo.png exists.
Create static/employee_images/ if missing:mkdir "D:\Smart Face-Based Attendance System\smartface_project\static\employee_images"

Step 7: Initialize Database (If Needed)
Create attendance.db tables: import sqlite3
conn = sqlite3.connect('attendance.db')
cursor = conn.cursor()
cursor.execute('CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY, name TEXT, embedding BLOB)')
cursor.execute('CREATE TABLE IF NOT EXISTS attendance (id TEXT, status TEXT, timestamp DATETIME, action TEXT)')
conn.commit()
conn.close()


Run in PowerShell: python -c "import sqlite3; conn = sqlite3.connect('attendance.db'); cursor = conn.cursor(); cursor.execute('CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY, name TEXT, embedding BLOB)'); cursor.execute('CREATE TABLE IF NOT EXISTS attendance (id TEXT, status TEXT, timestamp DATETIME, action TEXT)'); conn.commit(); conn.close()"

<br>

_Step 8: Run the Application_
Navigate to the project folder: cd "D:\Smart Face-Based Attendance System\smartface_project"

Run the Flask app: python app.py (Web Access)
  -> Access at http://127.0.0.1:5000 (Ctr+Click) in a browser.
  -> Login (User: admin / Password: 123)
  
Run the Flask app: face_attendance_insightface.py (Device Side! for Attendance Record)
  -> 1. Register a new face (user or employee)
     2. Extract embeddings from dataset
     3. Start attendance system (employees)
     4. Verify face (authentication)
     5. Exit
  -> Enter choice (1-5): 3
  
  Note: Choose 3 (For Attendance Record)

Step 9: Running the System!

_Troubleshooting_

InsightFace Compilation Error:
Ensure Microsoft Visual C++ Build Tools are installed.
Try a precompiled wheel:pip install insightface --find-links https://github.com/deepinsight/insightface/releases

ModuleNotFoundError:
Reinstall missing packages: pip install flask flask-socketio flask-login werkzeug insightface opencv-python numpy pandas pytz openpyxl

Webcam Issues:
Test webcam: import cv2
cap = cv2.VideoCapture(0)
print(cap.isOpened())  # Should print True
cap.release()

Ensure browser permissions for navigator.mediaDevices.getUserMedia.

InsightFace Model:
Verify model cache: dir $env:USERPROFILE\.insightface\models\buffalo_l

Redownload: from insightface.app import FaceAnalysis
app_face = FaceAnalysis(name='buffalo_l')
app_face.prepare(ctx_id=-1, det_size=(640, 640))  # CPU mode

Database Issues:
Recreate attendance.db (Step 7).

UI Issues:
Check Font Awesome/SocketIO CDNs in browser DevTools (F12 → Network).
Verify static/images/logo.png.

Notes
Dependencies: All packages are installed in .venv.
Security: Use HTTPS in production for webcam access.
Performance: Adjust ArcFace similarity threshold (0.45) if needed.

Attention: This applications, especially in AI, deep learning, video processing, and scientific computing, can benefit from _GPU_ acceleration.

For issues, contact the _project author_ or check logs in app.py.









