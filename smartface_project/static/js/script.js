  const socket = io('http://127.0.0.1:5000');
        const sidebar = document.getElementById('sidebar');
        const content = document.getElementById('content');
        let shiftModalData = null;
        let attendancePieChart = null;
let isChartUpdating = false; // Flag to prevent concurrent updates
       function showLoadingModal(message) {
    const loadingModal = document.getElementById('loadingModal');
    if (loadingModal) {
        loadingModal.querySelector('p').textContent = message;
        loadingModal.style.display = 'flex';
    }
}
// Debounce utility to limit rapid function calls
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

       function hideLoadingModal() {
    const loadingModal = document.getElementById('loadingModal');
    if (loadingModal && loadingModal.parentElement) {
        loadingModal.style.display = 'none';
    }
}

        function toggleSidebar() {
            sidebar.classList.toggle('active');
            content.classList.toggle('shifted');
        }

   function updatePieChart() {
    if (isChartUpdating) {
        console.log('Skipping pie chart update: already in progress');
        return;
    }
    isChartUpdating = true;

    const canvas = document.getElementById('attendancePieChart');
    if (!canvas) {
        console.error('Canvas element with ID "attendancePieChart" not found');
        const errorElement = document.getElementById('attendanceError');
        if (errorElement) {
            errorElement.textContent = 'Chart canvas not found. Please check the page structure.';
            errorElement.style.display = 'block';
        }
        isChartUpdating = false;
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Failed to get 2D context for canvas');
        const errorElement = document.getElementById('attendanceError');
        if (errorElement) {
            errorElement.textContent = 'Failed to initialize chart context';
            errorElement.style.display = 'block';
        }
        isChartUpdating = false;
        return;
    }

    // Ensure previous chart is destroyed
    if (attendancePieChart) {
        try {
            attendancePieChart.destroy();
            attendancePieChart = null;
            console.log('Previous chart destroyed successfully');
        } catch (error) {
            console.error('Error destroying existing chart:', error);
        }
    }

    const metric = document.getElementById('summaryMetric')?.value;
    if (!metric) {
        console.error('Summary metric element not found or invalid');
        const errorElement = document.getElementById('attendanceError');
        if (errorElement) {
            errorElement.textContent = 'Summary metric not found';
            errorElement.style.display = 'block';
        }
        isChartUpdating = false;
        return;
    }

    const dateRange = document.getElementById('searchDateRange')?.value.split(' to ');
    const startDate = dateRange[0];
    const endDate = dateRange[1] || startDate; // Use startDate as endDate for single day
    const errorElement = document.getElementById('attendanceError');

    if (!startDate) {
        console.error('Invalid or missing date range');
        errorElement.textContent = 'Please select a valid date range';
        errorElement.style.display = 'block';
        canvas.parentElement.innerHTML = '<p class="text-red-500">Please select a date range</p>';
        isChartUpdating = false;
        return;
    }

    showLoadingModal('Fetching chart data...');
    fetch(`/api/attendance?start_date=${startDate}&end_date=${endDate}`, { credentials: 'include' })
        .then(response => {
            console.log('Pie chart response status:', response.status);
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || `HTTP error! status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(attendanceData => {
            fetch('/api/employees', { credentials: 'include' })
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.json();
                })
                .then(employeeData => {
                    let labels = [];
                    let data = [];
                    let colors = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280'];

                    if (metric === 'attendance') {
                        const presentEmployees = new Set();
                        (attendanceData.attendance || []).forEach(record => {
                            if (record.status.toLowerCase() === 'present') {
                                presentEmployees.add(record.id);
                            }
                        });
                        const totalEmployees = employeeData.employees.length;
                        const presentCount = presentEmployees.size;
                        const absentCount = totalEmployees - presentCount;
                        labels = ['Present', 'Absent'];
                        data = [presentCount, absentCount];
                        colors = ['#10b981', '#ef4444'];
                    } else if (metric === 'gender') {
                        const genderCounts = {};
                        employeeData.employees.forEach(emp => {
                            const gender = emp.gender || 'Unknown';
                            genderCounts[gender] = (genderCounts[gender] || 0) + 1;
                        });
                        labels = Object.keys(genderCounts);
                        data = Object.values(genderCounts);
                    } else if (metric === 'department') {
                        const deptCounts = {};
                        employeeData.employees.forEach(emp => {
                            const dept = emp.department || 'Unknown';
                            deptCounts[dept] = (deptCounts[dept] || 0) + 1;
                        });
                        labels = Object.keys(deptCounts);
                        data = Object.values(deptCounts);
                    } else if (metric === 'position') {
                        const posCounts = {};
                        employeeData.employees.forEach(emp => {
                            const pos = emp.position || 'Unknown';
                            posCounts[pos] = (posCounts[pos] || 0) + 1;
                        });
                        labels = Object.keys(posCounts);
                        data = Object.values(posCounts);
                    }

                    try {
                        attendancePieChart = new Chart(ctx, {
                            type: 'pie',
                            data: {
                                labels: labels,
                                datasets: [{
                                    data: data,
                                    backgroundColor: colors,
                                    borderColor: ['#ffffff'],
                                    borderWidth: 1
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        position: 'top',
                                        labels: {
                                            color: '#e2e8f0',
                                            font: { size: 14 }
                                        }
                                    },
                                    title: {
                                        display: true,
                                        text: metric === 'attendance' ? 'Attendance Summary' :
                                              metric === 'gender' ? 'Gender Distribution' :
                                              metric === 'department' ? 'Department Distribution' :
                                              'Position Distribution',
                                        color: '#e2e8f0',
                                        font: { size: 16 }
                                    }
                                }
                            }
                        });
                        console.log('Chart created successfully');
                        errorElement.style.display = 'none';
                    } catch (error) {
                        console.error('Error creating chart:', error);
                        canvas.parentElement.innerHTML = '<p class="text-red-500">Error rendering chart</p>';
                        errorElement.textContent = 'Error rendering chart';
                        errorElement.style.display = 'block';
                    }
                })
                .catch(error => {
                    console.error('Error fetching employee data for chart:', error);
                    canvas.parentElement.innerHTML = '<p class="text-red-500">Error loading chart</p>';
                    errorElement.textContent = error.message || 'Error loading chart data';
                    errorElement.style.display = 'block';
                });
        })
        .catch(error => {
            console.error('Error fetching attendance data for chart:', error);
            canvas.parentElement.innerHTML = '<p class="text-red-500">Error loading chart</p>';
            errorElement.textContent = error.message || 'Error loading chart data';
            errorElement.style.display = 'block';
        })
        .finally(() => {
            hideLoadingModal();
            isChartUpdating = false;
        });
}

        socket.on('attendance_update', (data) => {
            const tbody = document.getElementById('todayAttendanceBody');
            const existingRows = tbody.getElementsByTagName('tr');
            for (let row of existingRows) {
                const cells = row.getElementsByTagName('td');
                if (cells[0]?.textContent === data.id && cells[2]?.textContent === data.timestamp && cells[3]?.textContent === data.action) {
                    return;
                }
            }
            const row = document.createElement('tr');
            row.innerHTML = `<td>${data.id}</td><td>${data.name}</td><td>${data.timestamp}</td><td class="action-${data.action.toLowerCase()}">${data.action}</td>`;
            row.style.backgroundColor = data.action.toLowerCase() === 'check-out' ? '#f6e05e' : '#68d391';
            setTimeout(() => { row.style.backgroundColor = '#4a5568'; }, 2000);
            tbody.prepend(row);
            document.getElementById('attendanceError').style.display = 'none';
            sortAttendanceTable();
            fetchEmployeeStatus();
            updateAttendanceStats();
        });

        socket.on('attendance_error', (data) => {
            const errorElement = document.getElementById('attendanceError');
            errorElement.textContent = `${data.message} (at ${data.timestamp || 'unknown time'})`;
            errorElement.style.display = 'block';
            setTimeout(() => { errorElement.style.display = 'none'; }, 5000);
        });

        function sortAttendanceTable() {
            const tbody = document.getElementById('todayAttendanceBody');
            const rows = Array.from(tbody.getElementsByTagName('tr'));
            rows.sort((a, b) => {
                const timeA = new Date(a.getElementsByTagName('td')[2].textContent);
                const timeB = new Date(b.getElementsByTagName('td')[2].textContent);
                return timeB - timeA;
            });
            tbody.innerHTML = '';
            rows.forEach(row => tbody.appendChild(row));
        }

        function fetchTodayAttendance() {
            document.getElementById('refreshLoading').style.display = 'inline';
            fetch('/api/attendance/today', { credentials: 'include' })
                .then(response => response.json())
                .then(data => {
                    const tbody = document.getElementById('todayAttendanceBody');
                    tbody.innerHTML = '';
                    if (data.attendance && Array.isArray(data.attendance)) {
                        data.attendance.forEach(row => {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `<td>${row.id}</td><td>${row.name}</td><td>${row.timestamp}</td><td class="action-${row.action.toLowerCase()}">${row.action}</td>`;
                            tbody.appendChild(tr);
                        });
                        sortAttendanceTable();
                    } else {
                        tbody.innerHTML = '<tr><td colspan="4">No attendance data available</td></tr>';
                    }
                    document.getElementById('refreshLoading').style.display = 'none';
                })
                .catch(error => {
                    console.error('Error fetching today attendance:', error);
                    document.getElementById('todayAttendanceBody').innerHTML = '<tr><td colspan="4">Error loading attendance data</td></tr>';
                    document.getElementById('refreshLoading').style.display = 'none';
                });
        }

        function fetchTotalEmployees() {
            fetch('/api/total_employees', { credentials: 'include' })
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    document.getElementById('totalEmployees').textContent = data.total_employees || 0;
                })
                .catch(error => {
                    console.error('Error fetching total employees:', error);
                    document.getElementById('totalEmployees').textContent = 'Error';
                    setTimeout(fetchTotalEmployees, 2000);
                });
        }

   function updateAttendanceStats() {
    const dateRange = document.getElementById('searchDateRange').value.split(' to ');
    const startDate = dateRange[0];
    const endDate = dateRange[1] || startDate;
    const exportBtn = document.getElementById('exportAttendance');
    const errorElement = document.getElementById('attendanceError');
    const tbody = document.getElementById('searchAttendanceBody');

    console.log('updateAttendanceStats triggered, startDate:', startDate, 'endDate:', endDate);

    if (!startDate) {
        errorElement.textContent = 'Please select a start date';
        errorElement.style.display = 'block';
        tbody.innerHTML = '<tr><td colspan="10">Please select a date range</td></tr>';
        exportBtn.classList.add('hidden');
        return;
    }

    showLoadingModal('Fetching attendance data...');
    const url = `/api/attendance?start_date=${startDate}&end_date=${endDate}`;
    fetch(url, { credentials: 'include' })
        .then(response => {
            console.log('Attendance API status:', response.status);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log('Attendance data:', data);
            tbody.innerHTML = '';
            const attendance = data.attendance || [];
            if (attendance.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10">No attendance data available for this date range.</td></tr>';
                exportBtn.classList.add('hidden');
                errorElement.textContent = 'No data found for the selected date range';
                errorElement.style.display = 'block';
            } else {
                fetch('/api/employees', { credentials: 'include' })
                    .then(response => {
                        console.log('Employees API status:', response.status);
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        return response.json();
                    })
                    .then(employeeData => {
                        console.log('Employee data:', employeeData);
                        const employeeMap = new Map(employeeData.employees.map(emp => [emp.id, emp]));
                        attendance.forEach(record => {
                            const emp = employeeMap.get(record.id) || {};
                            const tr = document.createElement('tr');
                            tr.innerHTML = `
                                <td>${record.id}</td>
                                <td>${record.name}</td>
                                <td>${emp.gender || '-'}</td>
                                <td>${emp.date_of_birth || '-'}</td>
                                <td>${emp.department || '-'}</td>
                                <td>${emp.position || '-'}</td>
                                <td>${emp.phone_number || '-'}</td>
                                <td class="status-${record.status.toLowerCase()}">${record.status}</td>
                                <td>${record.timestamp || '-'}</td>
                                <td class="action-${record.action?.toLowerCase() || ''}">${record.action || '-'}</td>`;
                            tbody.appendChild(tr);
                        });
                        exportBtn.classList.remove('hidden');
                        errorElement.style.display = 'none';
                        searchAttendance(); // Re-apply search after populating
                    })
                    .catch(error => {
                        console.error('Error fetching employee data:', error);
                        tbody.innerHTML = '<tr><td colspan="10">Error loading employee details</td></tr>';
                        exportBtn.classList.add('hidden');
                        errorElement.textContent = 'Error loading employee data';
                        errorElement.style.display = 'block';
                    });
            }
            const presentEmployees = new Set();
            attendance.forEach(record => {
                if (record.status.toLowerCase() === 'present') {
                    presentEmployees.add(record.id);
                }
            });
            fetch('/api/total_employees', { credentials: 'include' })
                .then(response => {
                    console.log('Total employees API status:', response.status);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.json();
                })
                .then(totalData => {
                    const totalEmployees = totalData.total_employees || 0;
                    const presentCount = presentEmployees.size;
                    const absentCount = totalEmployees - presentCount;
                    document.getElementById('totalPresent').textContent = presentCount || 0;
                    document.getElementById('totalAbsent').textContent = absentCount || 0;
                    if (document.getElementById('summaryMetric').value === 'attendance') {
                        updatePieChart();
                    }
                })
                .catch(error => {
                    console.error('Error fetching total employees:', error);
                    document.getElementById('totalPresent').textContent = presentEmployees.size || 0;
                    document.getElementById('totalAbsent').textContent = 'Error';
                    if (document.getElementById('summaryMetric').value === 'attendance') {
                        updatePieChart();
                    }
                });
        })
        .catch(error => {
            console.error('Error fetching attendance stats:', error);
            tbody.innerHTML = '<tr><td colspan="10">Error loading data</td></tr>';
            exportBtn.classList.add('hidden');
            errorElement.textContent = 'Error fetching attendance data';
            errorElement.style.display = 'block';
        })
        .finally(() => {
            hideLoadingModal();
        });
}

        function fetchEmployeeStatus() {
            fetch('/api/employees', { credentials: 'include' })
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    const tbody = document.getElementById('employeesBody');
                    tbody.innerHTML = '';
                    if (data.employees && Array.isArray(data.employees)) {
                        data.employees.forEach(emp => {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `
                                <td>${emp.id}</td>
                                <td>${emp.name}</td>
                                <td>${emp.gender || '-'}</td>
                                <td>${emp.date_of_birth || '-'}</td>
                                <td>${emp.department || '-'}</td>
                                <td>${emp.position || '-'}</td>
                                <td>${emp.phone_number || '-'}</td>
                                <td>${emp.check_in_start || '-'} - ${emp.check_in_end || '-'}</td>
                                <td>${emp.check_out_start || '-'} - ${emp.check_out_end || '-'}</td>
                                <td>
                                    <div class="dropdown">
                                        <button class="bg-gray-600 text-white btn flex items-center">Actions <span class="fas fa-chevron-down ml-1"></span></button>
                                        <div class="dropdown-content">
                                            <a href="#Edit Employee" onclick="showEmployeeForm('update', '${emp.id}', '${emp.name}', '${emp.gender || ''}', '${emp.date_of_birth || ''}', '${emp.department || ''}', '${emp.position || ''}', '${emp.phone_number || ''}')">Edit</a>
                                            <a href="#" onclick="deleteEmployee('${emp.id}')">Delete</a>
                                            <a href="#" onclick="openShiftModal('${emp.id}')">Set Schedule</a>
                                            <a href="#" onclick="retrainEmployeeFace('${emp.id}')">Retrain Face</a>
                                        </div>
                                    </div>
                                </td>`;
                            tbody.appendChild(tr);
                        });
                    } else {
                        tbody.innerHTML = '<tr><td colspan="10">No employees found</td></tr>';
                    }
                })
                .catch(error => {
                    console.error('Error fetching employee status:', error);
                    document.getElementById('employeesBody').innerHTML = '<tr><td colspan="10">Error loading employees</td></tr>';
                });
        }

        setInterval(fetchEmployeeStatus, 60000);

function showLoadingPopup() {
    // Create loading popup container
    const popup = document.createElement('div');
    popup.id = 'loadingPopup';
    popup.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50';
    
    // Loading popup card
    const popupCard = document.createElement('div');
    popupCard.className = 'card bg-gray-700 text-white p-6 rounded-lg border border-gray-600';
    popupCard.innerHTML = `
        <div class="flex items-center space-x-4">
            <i class="fas fa-spinner fa-spin text-2xl"></i>
            <span class="text-lg">Processing, please wait...</span>
        </div>
    `;
    
    popup.appendChild(popupCard);
    document.body.appendChild(popup);
    return popup;
}

function hideLoadingPopup() {
    const popup = document.getElementById('loadingPopup');
    if (popup) {
        document.body.removeChild(popup);
    }
}


   function showEmployeeForm(action, id = '', name = '', gender = '', date_of_birth = '', department = '', position = '', phone_number = '') {
    const form = document.getElementById('employeeForm');
    const title = document.getElementById('formTitle');
    const saveBtn = document.getElementById('saveBtn');
    const trainButton = document.getElementById('trainButton');
    const trainBtn = document.getElementById('trainBtn');
    
    // Show form and reset field visibility
    form.classList.remove('hidden');
    const fields = ['empGender', 'empDOB', 'empDepartment', 'empPosition', 'empPhone'];
    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        field.style.display = 'block'; // Reset to default
        field.required = false; // Reset to default
    });

    // Populate form fields
    document.getElementById('empId').value = id;
    document.getElementById('empName').value = name;
    document.getElementById('empGender').value = gender;
    document.getElementById('empDOB').value = date_of_birth;
    document.getElementById('empDepartment').value = department;
    document.getElementById('empPosition').value = position;
    document.getElementById('empPhone').value = phone_number;

    if (action === 'create') {
        title.textContent = 'Register Employee Face';
        saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Register';
        saveBtn.onclick = () => saveEmployeeWithPopup();
        trainButton.classList.remove('hidden');
        trainBtn.onclick = () => trainFace(id, name);

        // Hide and make non-required: Gender, DOB, Department, Position, Phone Number
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            field.style.display = 'none';
            field.required = false;
        });

        window.scrollTo({
            top: form.getBoundingClientRect().top + window.pageYOffset - 60,
            behavior: 'smooth'
        });
    } else if (action === 'update') {
        title.textContent = 'Edit Employee';
        saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Update';
        saveBtn.onclick = () => updateEmployee(id);
        trainButton.classList.remove('hidden');
        trainBtn.onclick = () => retrainEmployeeFace(id);
        document.getElementById('empId').disabled = true;

        window.scrollTo({
            top: form.getBoundingClientRect().top + window.pageYOffset - 60,
            behavior: 'smooth'
        });
    }
}


function saveEmployeeWithPopup() {
    const empId = document.getElementById('empId').value;
    const empName = document.getElementById('empName').value;

    if (!empId || !empName) {
        alert('ID and Name are required');
        return;
    }

    // Show loading popup
    const loadingPopup = showLoadingPopup();

    fetch('/api/employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: empId, name: empName })
    })
    .then(response => response.json())
    .then(data => {
        // Hide loading popup
        hideLoadingPopup();

        if (data.status === 'success') {
            showUpdatePopup(data.id, data.message, empName);
            document.getElementById('employeeForm').classList.add('hidden');
        } else {
            alert(data.message || 'Error adding employee');
        }
    })
    .catch(error => {
        // Hide loading popup on error
        hideLoadingPopup();
        console.error('Error:', error);
        alert('Failed to add employee');
    });
}

function showUpdatePopup(employeeId, message, empName) {
    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50';
    
    // Popup card
    const popupCard = document.createElement('div');
    popupCard.className = 'card bg-gray-700 text-white p-6 rounded-lg border border-gray-600 max-w-md w-full';
    popupCard.innerHTML = `
        <h3 class="text-lg font-semibold mb-4">${message}</h3>
        <div class="space-y-4">
            <input type="text" id="popup-gender" placeholder="Gender" class="w-full p-2 rounded-lg border border-gray-600 bg-gray-700 text-white">
            <input type="date" id="popup-dob" placeholder="Date of Birth" class="w-full p-2 rounded-lg border border-gray-600 bg-gray-700 text-white">
            <input type="text" id="popup-department" placeholder="Department" class="w-full p-2 rounded-lg border border-gray-600 bg-gray-700 text-white">
            <input type="text" id="popup-position" placeholder="Position" class="w-full p-2 rounded-lg border border-gray-600 bg-gray-700 text-white">
            <input type="text" id="popup-phone" placeholder="Phone Number" class="w-full p-2 rounded-lg border border-gray-600 bg-gray-700 text-white">
            <div class="flex space-x-4 mt-4">
                <button id="update-now" class="bg-green-600 text-white btn"><i class="fas fa-save mr-2"></i>Update Now</button>
                <button id="fill-later" class="bg-red-600 text-white btn"><i class="fas fa-times mr-2"></i>Fill Later</button>
            </div>
        </div>
    `;
    
    popup.appendChild(popupCard);
    document.body.appendChild(popup);
    
    // Update Now button
    document.getElementById('update-now').addEventListener('click', () => {
        const gender = document.getElementById('popup-gender').value || null;
        const date_of_birth = document.getElementById('popup-dob').value || null;
        const department = document.getElementById('popup-department').value || null;
        const position = document.getElementById('popup-position').value || null;
        const phone_number = document.getElementById('popup-phone').value || null;
        
        // Show loading popup
        const loadingPopup = showLoadingPopup();

        fetch(`/api/employee/${employeeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: empName, // Retain original name
                gender,
                date_of_birth,
                department,
                position,
                phone_number
            })
        })
        .then(response => response.json())
        .then(data => {
            // Hide loading popup
            hideLoadingPopup();

            if (data.status === 'success') {
                alert(data.message);
            } else {
                alert(data.message || 'Error updating employee');
            }
        })
        .catch(error => {
            // Hide loading popup on error
            hideLoadingPopup();
            console.error('Error:', error);
            alert('Failed to update employee');
        })
        .finally(() => {
            document.body.removeChild(popup);
        });
    });
    
    // Fill Later button
    document.getElementById('fill-later').addEventListener('click', () => {
        document.body.removeChild(popup);
    });
}

        function saveEmployee() {
            const id = document.getElementById('empId').value;
            const name = document.getElementById('empName').value;
            const gender = document.getElementById('empGender').value;
            const date_of_birth = document.getElementById('empDOB').value;
            const department = document.getElementById('empDepartment').value;
            const position = document.getElementById('empPosition').value;
            const phone_number = document.getElementById('empPhone').value;
            if (id && name) {
                showLoadingModal('Saving Employee...');
                fetch('/api/employee', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, name, gender, date_of_birth, department, position, phone_number })
                }).then(response => {
                    hideLoadingModal();
                    if (response.ok) {
                        cancelEmployee();
                        fetchEmployees();
                        fetchEmployeeStatus();
                        fetchTotalEmployees();
                        alert('New employee added successfully!');
                    } else {
                        return response.json().then(data => { throw new Error(data.message || 'Error adding employee'); });
                    }
                }).catch(error => {
                    hideLoadingModal();
                    console.error('Error saving employee:', error);
                    alert(error.message);
                });
            } else {
                alert('Please enter both ID and Name');
            }
        }

        function updateEmployee(id) {
            const name = document.getElementById('empName').value;
            const gender = document.getElementById('empGender').value;
            const date_of_birth = document.getElementById('empDOB').value;
            const department = document.getElementById('empDepartment').value;
            const position = document.getElementById('empPosition').value;
            const phone_number = document.getElementById('empPhone').value;
            if (name) {
                fetch(`/api/employee/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, gender, date_of_birth, department, position, phone_number })
                }).then(response => {
                    if (response.ok) {
                        cancelEmployee();
                        fetchEmployees();
                        fetchEmployeeStatus();
                        alert('Employee updated successfully!');
                    } else {
                        return response.json().then(data => { throw new Error(data.message || 'Error updating employee'); });
                    }
                }).catch(error => {
                    console.error('Error updating employee:', error);
                    alert(error.message);
                });
            } else {
                alert('Please enter a Name');
            }
        }

        function trainFace(id, name) {
            if (id && name) {
                if (confirm('Please save before train')) {
                    showLoadingModal('Saving Employee...');
                    fetch('/api/employee', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, name })
                    }).then(response => {
                        if (response.ok) {
                            showLoadingModal('Training Face...');
                            fetch(`/api/employee/retrain/${id}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id, name })
                            }).then(trainResponse => {
                                hideLoadingModal();
                                if (trainResponse.ok) {
                                    document.getElementById('trainButton').classList.add('hidden');
                                    alert('Face trained successfully!');
                                    fetchEmployeeStatus();
                                    fetchEmployees();
                                    fetchTotalEmployees();
                                    cancelEmployee();
                                } else {
                                    return trainResponse.json().then(data => { throw new Error(data.message || 'Face training failed'); });
                                }
                            }).catch(error => {
                                hideLoadingModal();
                                console.error('Error training face:', error);
                                alert(error.message);
                            });
                        } else {
                            hideLoadingModal();
                            return response.json().then(data => { throw new Error(data.message || 'Error saving employee'); });
                        }
                    }).catch(error => {
                        hideLoadingModal();
                        console.error('Error saving employee:', error);
                        alert(error.message);
                    });
                }
            } else {
                alert('Please enter both ID and Name');
            }
        }

        function retrainEmployeeFace(id) {
            const modal = document.getElementById('retrainConfirmModal');
            const confirmBtn = document.getElementById('confirmRetrainBtn');
            confirmBtn.onclick = () => confirmRetrainFace(id);
            modal.style.display = 'flex';
        }

        function confirmRetrainFace(id) {
            document.getElementById('retrainConfirmModal').style.display = 'none';
            showLoadingModal('Retraining Face...');
            fetch(`/api/employee/retrain/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id })
            })
                .then(response => {
                    hideLoadingModal();
                    return response.json();
                })
                .then(data => {
                    alert(data.message || 'Face retrained successfully!');
                    fetchEmployeeStatus();
                })
                .catch(error => {
                    hideLoadingModal();
                    console.error('Error retraining face:', error);
                    alert('Error retraining face');
                });
        }

        function cancelRetrainFace() {
            document.getElementById('retrainConfirmModal').style.display = 'none';
        }

        function deleteEmployee(id) {
            const modal = document.getElementById('deleteConfirmModal');
            const confirmBtn = document.getElementById('confirmDeleteBtn');
            confirmBtn.onclick = () => confirmDeleteEmployee(id);
            modal.style.display = 'flex';
        }

        function confirmDeleteEmployee(id) {
            document.getElementById('deleteConfirmModal').style.display = 'none';
            fetch(`/api/employee/${id}`, { method: 'DELETE', credentials: 'include' })
                .then(response => {
                    if (response.ok) {
                        fetchEmployees();
                        fetchEmployeeStatus();
                        fetchTotalEmployees();
                        alert('Employee deleted successfully!');
                    } else {
                        return response.json().then(data => { throw new Error(data.message || 'Error deleting employee'); });
                    }
                })
                .catch(error => {
                    console.error('Error deleting employee:', error);
                    alert(error.message);
                });
        }

        function cancelEmployee() {
            document.getElementById('employeeForm').classList.add('hidden');
            document.getElementById('empId').value = '';
            document.getElementById('empName').value = '';
            document.getElementById('empGender').value = '';
            document.getElementById('empDOB').value = '';
            document.getElementById('empDepartment').value = '';
            document.getElementById('empPosition').value = '';
            document.getElementById('empPhone').value = '';
            document.getElementById('empId').disabled = false;
            document.getElementById('trainButton').classList.add('hidden');
        }

        function fetchEmployees() {
            fetch('/api/employees', { credentials: 'include' })
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    const tbody = document.getElementById('employeesBody');
                    tbody.innerHTML = '';
                    if (data.employees && Array.isArray(data.employees)) {
                        data.employees.forEach(emp => {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `
                                <td>${emp.id}</td>
                                <td>${emp.name}</td>
                                <td>${emp.gender || '-'}</td>
                                <td>${emp.date_of_birth || '-'}</td>
                                <td>${emp.department || '-'}</td>
                                <td>${emp.position || '-'}</td>
                                <td>${emp.phone_number || '-'}</td>
                                <td>${emp.check_in_start || '-'} - ${emp.check_in_end || '-'}</td>
                                <td>${emp.check_out_start || '-'} - ${emp.check_out_end || '-'}</td>
                                <td>
                                    <div class="dropdown">
                                        <button class="bg-gray-600 text-white btn flex items-center">Actions <span class="fas fa-chevron-down ml-1"></span></button>
                                        <div class="dropdown-content">
                                            <a href="#" onclick="showEmployeeForm('update', '${emp.id}', '${emp.name}', '${emp.gender || ''}', '${emp.date_of_birth || ''}', '${emp.department || ''}', '${emp.position || ''}', '${emp.phone_number || ''}')">Edit</a>
                                            <a href="#" onclick="deleteEmployee('${emp.id}')">Delete</a>
                                            <a href="#" onclick="openShiftModal('${emp.id}')">Set Schedule</a>
                                            <a href="#" onclick="retrainEmployeeFace('${emp.id}')">Retrain Face</a>
                                        </div>
                                    </div>
                                </td>`;
                            tbody.appendChild(tr);
                        });
                    } else {
                        tbody.innerHTML = '<tr><td colspan="10">No employees found</td></tr>';
                    }
                })
                .catch(error => {
                    console.error('Error fetching employees:', error);
                    document.getElementById('employeesBody').innerHTML = '<tr><td colspan="10">Error loading employees</td></tr>';
                });
        }

        function searchEmployees() {
            const input = document.getElementById('searchEmployee').value.toLowerCase();
            const tbody = document.getElementById('employeesBody');
            const rows = tbody.getElementsByTagName('tr');
            for (let i = 0; i < rows.length; i++) {
                const id = rows[i].getElementsByTagName('td')[0]?.textContent.toLowerCase();
                const name = rows[i].getElementsByTagName('td')[1]?.textContent.toLowerCase();
                const gender = rows[i].getElementsByTagName('td')[2]?.textContent.toLowerCase();
                const dob = rows[i].getElementsByTagName('td')[3]?.textContent.toLowerCase();
                const department = rows[i].getElementsByTagName('td')[4]?.textContent.toLowerCase();
                const position = rows[i].getElementsByTagName('td')[5]?.textContent.toLowerCase();
                const phone = rows[i].getElementsByTagName('td')[6]?.textContent.toLowerCase();
                rows[i].style.display = (
                    id?.includes(input) ||
                    name?.includes(input) ||
                    gender?.includes(input) ||
                    dob?.includes(input) ||
                    department?.includes(input) ||
                    position?.includes(input) ||
                    phone?.includes(input)
                ) ? '' : 'none';
            }
            document.querySelector('#all-employees .table-container').scrollTop = 0;
        }

   function searchAttendance() {
    const input = document.getElementById('searchAttendance').value.toLowerCase();
    const tbody = document.getElementById('searchAttendanceBody');
    const rows = tbody.getElementsByTagName('tr');
    const errorElement = document.getElementById('attendanceError');
    let visibleRows = 0;

    console.log('searchAttendance triggered, input:', input, 'rows:', rows.length);

    for (let i = 0; i < rows.length; i++) {
        const tds = rows[i].getElementsByTagName('td');
        const id = tds[0]?.textContent?.toLowerCase() || '';
        const name = tds[1]?.textContent?.toLowerCase() || '';
        const gender = tds[2]?.textContent?.toLowerCase() || '';
        const dob = tds[3]?.textContent?.toLowerCase() || '';
        const department = tds[4]?.textContent?.toLowerCase() || '';
        const position = tds[5]?.textContent?.toLowerCase() || '';
        const phone = tds[6]?.textContent?.toLowerCase() || '';
        
        rows[i].style.display = input === '' || (
            id.includes(input) ||
            name.includes(input) ||
            (gender !== '-' && gender.includes(input)) ||
            (dob !== '-' && dob.includes(input)) ||
            (department !== '-' && department.includes(input)) ||
            (position !== '-' && position.includes(input)) ||
            (phone !== '-' && phone.includes(input))
        ) ? '' : 'none';

        if (rows[i].style.display === '') visibleRows++;
    }

    if (rows.length === 0) {
        errorElement.textContent = 'No attendance data available. Please select a date range.';
        errorElement.style.display = 'block';
    } else if (visibleRows === 0 && input !== '') {
        errorElement.textContent = 'No records match your search';
        errorElement.style.display = 'block';
    } else {
        errorElement.style.display = 'none';
    }

    document.querySelector('#all-attendance .table-container').scrollTop = 0;
}

        function openShiftModal(id) {
            const modal = document.getElementById('shiftModal');
            const title = document.getElementById('shiftModalTitle');
            const form = document.getElementById('shiftForm');
            const employeeIdInput = document.getElementById('shiftEmployeeId');
            const error = document.getElementById('shiftError');
            const confirmModal = document.getElementById('confirmModal');
            const confirmModalTitle = confirmModal.querySelector('h2');
            const confirmModalMessage = confirmModal.querySelector('p');
            error.style.display = 'none';
            employeeIdInput.value = id;
            title.textContent = id === 'all' ? 'Set Schedule for All Employees' : `Set Schedule for Employee ${id}`;
            form.reset();
            if (id === 'all') {
                document.getElementById('checkInStart').value = '08:00';
                document.getElementById('checkInEnd').value = '09:00';
                document.getElementById('checkOutStart').value = '17:00';
                document.getElementById('checkOutEnd').value = '18:00';
            }
            modal.style.display = 'flex';
            form.onsubmit = function(e) {
                e.preventDefault();
                const checkInStart = document.getElementById('checkInStart').value;
                const checkInEnd = document.getElementById('checkInEnd').value;
                const checkOutStart = document.getElementById('checkOutStart').value;
                const checkOutEnd = document.getElementById('checkOutEnd').value;
                if (!checkInStart || !checkInEnd || !checkOutStart || !checkOutEnd) {
                    error.textContent = 'All time fields are required';
                    error.style.display = 'block';
                    return;
                }
                if (checkInEnd <= checkInStart) {
                    error.textContent = 'Check-in End must be after Check-in Start';
                    error.style.display = 'block';
                    return;
                }
                if (checkOutStart <= checkInEnd) {
                    error.textContent = 'Check-out Start must be after Check-in End';
                    error.style.display = 'block';
                    return;
                }
                if (checkOutEnd <= checkOutStart) {
                    error.textContent = 'Check-out End must be after Check-out Start';
                    error.style.display = 'block';
                    return;
                }
                const data = { check_in_start: checkInStart, check_in_end: checkInEnd, check_out_start: checkOutStart, check_out_end: checkOutEnd };
                shiftModalData = { id, data };
                if (id === 'all') {
                    fetch('/api/employees', { credentials: 'include' })
                        .then(response => response.json())
                        .then(data => {
                            if (data.employees && Array.isArray(data.employees)) {
                                Promise.all(data.employees.map(emp =>
                                    fetch(`/api/employee/schedule/${emp.id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(shiftModalData.data)
                                    })
                                )).then(responses => {
                                    if (responses.every(res => res.ok)) {
                                        document.getElementById('shiftModal').style.display = 'none';
                                        confirmModalTitle.textContent = 'Confirm Schedule Update';
                                        confirmModalMessage.textContent = 'Schedules set successfully for all employees. Apply changes?';
                                        confirmModal.style.display = 'flex';
                                    } else {
                                        error.textContent = 'Error setting schedules for some employees';
                                        error.style.display = 'block';
                                    }
                                }).catch(err => {
                                    console.error('Error setting schedules:', err);
                                    error.textContent = 'Error setting schedules';
                                    error.style.display = 'block';
                                });
                            }
                        })
                        .catch(error => {
                            console.error('Error fetching employees:', error);
                            error.textContent = 'Error fetching employees';
                            error.style.display = 'block';
                        });
                } else {
                    fetch(`/api/employee/schedule/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    }).then(response => {
                        if (response.ok) {
                            document.getElementById('shiftModal').style.display = 'none';
                            confirmModalTitle.textContent = 'Confirm Schedule Update';
                            confirmModalMessage.textContent = `Schedule set successfully for Employee ${id}. Apply changes?`;
                            confirmModal.style.display = 'flex';
                        } else {
                            response.json().then(data => {
                                error.textContent = data.message || 'Error setting schedule';
                                error.style.display = 'block';
                            });
                        }
                    }).catch(error => {
                        console.error('Error setting schedule:', error);
                        error.textContent = 'Error setting schedule';
                        error.style.display = 'block';
                    });
                }
            };
        }

        function closeShiftModal() {
            document.getElementById('shiftModal').style.display = 'none';
            document.getElementById('shiftForm').reset();
            document.getElementById('shiftError').style.display = 'none';
            shiftModalData = null;
        }

        function applyConfirmModal() {
            document.getElementById('confirmModal').style.display = 'none';
            fetchEmployees();
            fetchEmployeeStatus();
            shiftModalData = null;
        }

        function cancelConfirmModal() {
            document.getElementById('confirmModal').style.display = 'none';
            const { id, data } = shiftModalData || {};
            if (id) {
                const modal = document.getElementById('shiftModal');
                document.getElementById('checkInStart').value = data.check_in_start;
                document.getElementById('checkInEnd').value = data.check_in_end;
                document.getElementById('checkOutStart').value = data.check_out_start;
                document.getElementById('checkOutEnd').value = data.check_out_end;
                document.getElementById('shiftEmployeeId').value = id;
                document.getElementById('shiftModalTitle').textContent = id === 'all' ? 'Set Schedule for All Employees' : `Set Schedule for Employee ${id}`;
                modal.style.display = 'flex';
            }
            shiftModalData = null;
        }

        function exportToExcel() {
            fetch('/api/employees/export', { credentials: 'include' })
                .then(response => {
                    if (!response.ok) return response.json().then(error => { throw new Error(error.error || 'Export failed'); });
                    return response.blob();
                })
                .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'employees.xlsx';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                })
                .catch(error => {
                    console.error('Error exporting employees:', error.message);
                    alert(`Error exporting: ${error.message}`);
                });
        }

        function importFromExcel(event) {
            const file = event.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            fetch('/api/employees/import', {
                method: 'POST',
                credentials: 'include',
                body: formData
            })
                .then(response => {
                    if (response.ok) return response.json();
                    return response.json().then(error => { throw new Error(error.error || 'Import failed'); });
                })
                .then(data => {
                    alert(data.message || 'Import completed successfully');
                    event.target.value = '';
                    fetchEmployees();
                    fetchEmployeeStatus();
                    fetchTotalEmployees();
                })
                .catch(error => {
                    console.error('Error importing employees:', error.message);
                    alert(`Error importing: ${error.message}`);
                });
        }

    function exportAttendance() {
    const dateRange = document.getElementById('searchDateRange').value.split(' to ');
    const startDate = dateRange[0];
    const endDate = dateRange[1] || startDate;
    const errorElement = document.getElementById('attendanceError');

    if (!startDate) {
        errorElement.textContent = 'Please select a valid date range';
        errorElement.style.display = 'block';
        return;
    }

    showLoadingModal('Exporting attendance data...');
    fetch(`/api/attendance/export?start_date=${startDate}&end_date=${endDate}`, {
        method: 'GET',
        credentials: 'include'
    })
        .then(response => {
            console.log('Export response status:', response.status);
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || `HTTP error! status: ${response.status}`);
                });
            }
            return response.blob();
        })
        .then(blob => {
            console.log('Blob size:', blob.size);
            if (blob.size === 0) {
                throw new Error('Empty file received from server');
            }
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance_${startDate}${startDate === endDate ? '' : '_to_' + endDate}.xlsx`;
            document.body.appendChild(a);
            a.click();
            console.log('Download triggered');
            a.remove();
            window.URL.revokeObjectURL(url);
            errorElement.style.display = 'none';
        })
        .catch(error => {
            console.error('Export error details:', error, error.stack);
            errorElement.textContent = error.message || 'Failed to export attendance data';
            errorElement.style.display = 'block';
        })
        .finally(() => {
            hideLoadingModal();
        });
}

// Debounced version with increased delay (500ms)
const debouncedUpdatePieChart = debounce(updatePieChart, 500);

document.addEventListener('DOMContentLoaded', function () {
    // Initialize Flatpickr
    const dateRangePicker = document.getElementById('searchDateRange');
    if (dateRangePicker) {
        flatpickr('#searchDateRange', {
            mode: 'range',
            dateFormat: 'Y-m-d',
            defaultDate: [new Date().toISOString().split('T')[0], new Date().toISOString().split('T')[0]],
            onClose: function (selectedDates) {
                debouncedUpdatePieChart();
                updateAttendanceStats();
            }
        });
    } else {
        console.error('Date range picker element with ID "searchDateRange" not found');
    }

    // Ensure canvas exists before calling updatePieChart
    const canvas = document.getElementById('attendancePieChart');
    if (canvas) {
        debouncedUpdatePieChart();
    } else {
        console.error('Canvas element with ID "attendancePieChart" not found on page load');
        const errorElement = document.getElementById('attendanceError');
        if (errorElement) {
            errorElement.textContent = 'Chart canvas not found. Please check the page structure.';
            errorElement.style.display = 'block';
        }
    }

    // Update pie chart when metric changes
    const summaryMetric = document.getElementById('summaryMetric');
    if (summaryMetric) {
        // Remove existing listeners to prevent duplicates
        summaryMetric.removeEventListener('change', debouncedUpdatePieChart);
        summaryMetric.addEventListener('change', debouncedUpdatePieChart);
    } else {
        console.error('Summary metric element with ID "summaryMetric" not found');
    }

    // Existing event listeners for other features
    const exportButton = document.getElementById('exportAttendance');
    if (exportButton) {
        // Remove existing listeners to prevent duplicates
        exportButton.removeEventListener('click', exportAttendance);
        exportButton.addEventListener('click', exportAttendance);
    }
});
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchAttendance');
    if (searchInput) {
        console.log('searchAttendance input found, binding onkeyup');
        searchInput.addEventListener('keyup', searchAttendance);
    } else {
        console.error('searchAttendance input not found');
    }
    // ... existing initialization code ...
});

        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('importTrigger').addEventListener('click', function(e) {
                e.preventDefault();
                document.getElementById('importFile').click();
            });
            fetchTodayAttendance();
            fetchTotalEmployees();
            updateAttendanceStats();
            fetchEmployeeStatus();
            // fetchUsers();
            // updateTableHeight('todayAttendanceTable', 5);
            updateTableHeight('employeesTable', 5);
            updateTableHeight('searchAttendanceTable', 5);
        });