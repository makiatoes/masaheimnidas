// ============================================
// ADMIN DASHBOARD
// ============================================
$(document).ready(function() {
    // Only initialize dashboard if we're on the dashboard page
    if ($('#totalUsers').length > 0) {
        const user = getCurrentUser();
        
        if (!user || !isAuthenticated() || user.user_type !== 'admin') {
            window.location.href = 'login.html';
            return;
        }

        const fullName = (user.firstname || '') + ' ' + (user.lastname || '');
        $('#userFullName').text(fullName.trim() || user.username);
        $('#navUserName').text(user.username);

        // Logout functionality
        $('#logoutLink').on('click', function(e) {
            e.preventDefault();
            Swal.fire({
                title: 'Are you sure?',
                text: 'Do you want to logout?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, logout!'
            }).then((result) => {
                if (result.isConfirmed) {
                    const token = localStorage.getItem('token');
                    const headers = {};
                    if (token) {
                        headers.Authorization = `Bearer ${token}`;
                    }
                    
                    axios.post(`${API_BASE_URL}/api/auth/logout`, {}, { headers: headers })
                        .then(function() {
                            logout();
                        })
                        .catch(function() {
                            logout();
                        });
                }
            });
        });

        // Load dashboard stats
        loadDashboardStats();
    }
});

function loadDashboardStats() {
    if ($('#totalUsers').length === 0) return; // Only run on dashboard page
    
    // Load users count
    axios.get(`${API_BASE_URL}/api/users?per_page=1`)
        .then(function(response) {
            if (response.data.success) {
                $('#totalUsers').text(response.data.data.total || 0);
            }
        })
        .catch(function(error) {
            console.error('Error loading users count:', error);
        });

    // Load bookings count
    axios.get(`${API_BASE_URL}/api/bookings?per_page=1`)
        .then(function(response) {
            if (response.data.success) {
                $('#totalBookings').text(response.data.data.total || 0);
                
                // Count pending
                axios.get(`${API_BASE_URL}/api/bookings?status=pending&per_page=1`)
                    .then(function(res) {
                        if (res.data.success) {
                            $('#pendingBookings').text(res.data.data.total || 0);
                        }
                    });
            }
        })
        .catch(function(error) {
            console.error('Error loading bookings count:', error);
        });

    // Load services count
    axios.get(`${API_BASE_URL}/api/services?per_page=1`)
        .then(function(response) {
            if (response.data.success) {
                $('#totalServices').text(response.data.data.total || 0);
            }
        })
        .catch(function(error) {
            console.error('Error loading services count:', error);
        });

    // Load recent bookings
    axios.get(`${API_BASE_URL}/api/bookings?per_page=5`)
        .then(function(response) {
            if (response.data.success && response.data.data.data.length > 0) {
                const tbody = $('#recentBookingsTableBody');
                tbody.empty();
                response.data.data.data.forEach(booking => {
                    tbody.append(`
                        <tr>
                            <td>${booking.client.firstname} ${booking.client.lastname}</td>
                            <td>${booking.service.name}</td>
                            <td>${new Date(booking.booking_date).toLocaleDateString()}</td>
                            <td><span class="badge bg-${getStatusBadge(booking.status)}">${booking.status}</span></td>
                        </tr>
                    `);
                });
            }
        })
        .catch(function(error) {
            console.error('Error loading recent bookings:', error);
        });

    // Load recent users
    axios.get(`${API_BASE_URL}/api/users?per_page=5`)
        .then(function(response) {
            if (response.data.success && response.data.data.data.length > 0) {
                const tbody = $('#recentUsersTableBody');
                tbody.empty();
                response.data.data.data.forEach(user => {
                    tbody.append(`
                        <tr>
                            <td>${user.firstname} ${user.lastname}</td>
                            <td><span class="badge bg-${getUserTypeBadge(user.user_type)}">${user.user_type}</span></td>
                            <td>${user.email}</td>
                            <td>${user.is_verified ? '<span class="badge bg-success">Verified</span>' : '<span class="badge bg-danger">Unverified</span>'}</td>
                        </tr>
                    `);
                });
            }
        })
        .catch(function(error) {
            console.error('Error loading recent users:', error);
        });
}

// ============================================
// ADMIN USERS
// ============================================
let adminUsersCurrentPage = 1;
let adminUsersSearchQuery = '';
let adminUsersUserTypeFilter = '';

$(document).ready(function() {
    // Only initialize users page if we're on the users page
    if ($('#usersTableBody').length > 0 || $('#usersGridBody').length > 0) {
        checkAdminAuth();
        loadUsers();
        
        $('#searchInput').on('keyup', function(e) {
            if (e.key === 'Enter') {
                loadUsers();
            }
        });

        $('#userTypeFilter').on('change', function() {
            loadUsers();
        });

        $('#logoutLink').on('click', function(e) {
            e.preventDefault();
            Swal.fire({
                title: 'Are you sure?',
                text: 'Do you want to logout?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, logout!'
            }).then((result) => {
                if (result.isConfirmed) {
                    logout();
                }
            });
        });
    }
});

function checkAdminAuth() {
    const user = getCurrentUser();
    if (!user || !isAuthenticated() || user.user_type !== 'admin') {
        window.location.href = 'login.html';
    }
}

function loadUsers(page = 1) {
    adminUsersCurrentPage = page;
    adminUsersSearchQuery = $('#searchInput').val();
    adminUsersUserTypeFilter = $('#userTypeFilter').val();

    const params = new URLSearchParams({
        page: page,
    });
    if (adminUsersSearchQuery) params.append('search', adminUsersSearchQuery);
    if (adminUsersUserTypeFilter) params.append('user_type', adminUsersUserTypeFilter);

    axios.get(`${API_BASE_URL}/api/users?${params}`)
        .then(function(response) {
            if (response.data.success) {
                displayUsers(response.data.data);
                displayUsersPagination(response.data.data);
            }
        })
        .catch(function(error) {
            console.error('Error loading users:', error);
            $('#usersTableBody').html('<tr><td colspan="8" class="text-center text-danger">Error loading users</td></tr>');
            $('#usersGridBody').html('<div class="col-12 text-center text-danger">Error loading users</div>');
        });
}

function displayUsers(data) {
    const tbody = $('#usersTableBody');
    const gridBody = $('#usersGridBody');
    tbody.empty();
    gridBody.empty();

    if (data.data.length === 0) {
        tbody.html('<tr><td colspan="8" class="text-center">No users found</td></tr>');
        gridBody.html('<div class="col-12 text-center">No users found</div>');
        return;
    }

    // Get current logged-in user
    const currentUser = getCurrentUser();
    const currentUserId = currentUser ? currentUser.id : null;

    data.data.forEach(user => {
        // Disable delete button for super admin (user ID 1) and current user's own account
        let deleteButton;
        let deleteButtonDisabled = false;
        if (user.id === 1) {
            deleteButton = '<button class="btn btn-sm btn-danger" disabled title="Super admin cannot be deleted"><i class="bi bi-trash"></i></button>';
            deleteButtonDisabled = true;
        } else if (user.id === currentUserId) {
            deleteButton = '<button class="btn btn-sm btn-danger" disabled title="You cannot delete your own account"><i class="bi bi-trash"></i></button>';
            deleteButtonDisabled = true;
        } else {
            deleteButton = `<button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})"><i class="bi bi-trash"></i></button>`;
        }
        
        // Table row for desktop
        const row = `
            <tr>
                <td>${user.id}</td>
                <td>${user.firstname} ${user.lastname}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.phone}</td>
                <td><span class="badge bg-${getUserTypeBadge(user.user_type)}">${user.user_type}</span></td>
                <td>${user.is_verified ? '<span class="badge bg-success">Yes</span>' : '<span class="badge bg-danger">No</span>'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editUser(${user.id})"><i class="bi bi-pencil"></i></button>
                    ${deleteButton}
                </td>
            </tr>
        `;
        tbody.append(row);

        // Grid card for mobile
        const card = `
            <div class="col-12">
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <h5 class="card-title mb-1">${user.firstname} ${user.lastname}</h5>
                                <p class="text-muted small mb-0">ID: ${user.id}</p>
                            </div>
                            <div>
                                <span class="badge bg-${getUserTypeBadge(user.user_type)}">${user.user_type}</span>
                                ${user.is_verified ? '<span class="badge bg-success ms-1">Verified</span>' : '<span class="badge bg-danger ms-1">Not Verified</span>'}
                            </div>
                        </div>
                        <hr class="my-2">
                        <div class="mb-2">
                            <small class="text-muted d-block">Username</small>
                            <strong>${user.username}</strong>
                        </div>
                        <div class="mb-2">
                            <small class="text-muted d-block">Email</small>
                            <strong>${user.email}</strong>
                        </div>
                        <div class="mb-3">
                            <small class="text-muted d-block">Phone</small>
                            <strong>${user.phone || '<span class="text-muted">N/A</span>'}</strong>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-primary flex-fill" onclick="editUser(${user.id})">
                                <i class="bi bi-pencil"></i> Edit
                            </button>
                            ${deleteButtonDisabled ? 
                                `<button class="btn btn-sm btn-danger flex-fill" disabled>
                                    <i class="bi bi-trash"></i> Delete
                                </button>` :
                                `<button class="btn btn-sm btn-danger flex-fill" onclick="deleteUser(${user.id})">
                                    <i class="bi bi-trash"></i> Delete
                                </button>`
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
        gridBody.append(card);
    });
}

function displayUsersPagination(data) {
    const nav = $('#paginationNav');
    const navMobile = $('#paginationNavMobile');
    nav.empty();
    navMobile.empty();

    if (data.last_page <= 1) return;

    let pagination = '<ul class="pagination">';
    
    // Previous
    pagination += `<li class="page-item ${data.current_page === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="loadUsers(${data.current_page - 1}); return false;">Previous</a>
    </li>`;

    // Page numbers
    for (let i = 1; i <= data.last_page; i++) {
        if (i === 1 || i === data.last_page || (i >= data.current_page - 2 && i <= data.current_page + 2)) {
            pagination += `<li class="page-item ${i === data.current_page ? 'active' : ''}">
                <a class="page-link" href="#" onclick="loadUsers(${i}); return false;">${i}</a>
            </li>`;
        } else if (i === data.current_page - 3 || i === data.current_page + 3) {
            pagination += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
    }

    // Next
    pagination += `<li class="page-item ${data.current_page === data.last_page ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="loadUsers(${data.current_page + 1}); return false;">Next</a>
    </li>`;

    pagination += '</ul>';
    nav.html(pagination);
    navMobile.html(pagination);
}

function openUserModal() {
    $('#userModalTitle').text('Add User');
    $('#userForm')[0].reset();
    $('#userId').val('');
    $('#password').prop('required', true);
    $('#user_type').prop('disabled', false);
}

function editUser(id) {
    axios.get(`${API_BASE_URL}/api/users/${id}`)
        .then(function(response) {
            if (response.data.success) {
                const user = response.data.data;
                $('#userModalTitle').text('Edit User');
                $('#userId').val(user.id);
                $('#firstname').val(user.firstname);
                $('#lastname').val(user.lastname);
                $('#username').val(user.username);
                $('#email').val(user.email);
                $('#phone').val(user.phone);
                $('#user_type').val(user.user_type);
                $('#is_verified').prop('checked', user.is_verified);
                $('#password').prop('required', false);
                
                // Disable user type dropdown for user ID 1 (super admin)
                if (user.id === 1) {
                    $('#user_type').prop('disabled', true);
                } else {
                    $('#user_type').prop('disabled', false);
                }
                
                $('#userModal').modal('show');
            }
        })
        .catch(function(error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error loading user'
            });
        });
}

function saveUser() {
    const userId = $('#userId').val();
    const data = {
        firstname: $('#firstname').val(),
        lastname: $('#lastname').val(),
        username: $('#username').val(),
        email: $('#email').val(),
        phone: $('#phone').val(),
        user_type: $('#user_type').val(),
        is_verified: $('#is_verified').is(':checked') ? 1 : 0,
    };

    if ($('#password').val()) {
        data.password = $('#password').val();
    }

    const url = userId ? `${API_BASE_URL}/api/users/${userId}` : `${API_BASE_URL}/api/users`;
    const method = userId ? 'put' : 'post';

    axios[method](url, data)
        .then(function(response) {
            if (response.data.success) {
                $('#userModal').modal('hide');
                loadUsers(adminUsersCurrentPage);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'User saved successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        })
        .catch(function(error) {
            const message = error.response?.data?.message || 'Error saving user';
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: message
            });
        });
}

function deleteUser(id) {
    // Get current logged-in user
    const currentUser = getCurrentUser();
    const currentUserId = currentUser ? currentUser.id : null;

    // Prevent deletion of super admin
    if (id === 1) {
        Swal.fire({
            icon: 'warning',
            title: 'Cannot Delete',
            text: 'Cannot delete super admin account'
        });
        return;
    }

    // Prevent users from deleting their own account
    if (id === currentUserId) {
        Swal.fire({
            icon: 'warning',
            title: 'Cannot Delete',
            text: 'You cannot delete your own account'
        });
        return;
    }

    Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
        if (result.isConfirmed) {
            axios.delete(`${API_BASE_URL}/api/users/${id}`)
                .then(function(response) {
                    if (response.data.success) {
                        loadUsers(adminUsersCurrentPage);
                        Swal.fire({
                            icon: 'success',
                            title: 'Deleted!',
                            text: 'User deleted successfully',
                            timer: 2000,
                            showConfirmButton: false
                        });
                    }
                })
                .catch(function(error) {
                    const message = error.response?.data?.message || 'Error deleting user';
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: message
                    });
                });
        }
    });
}

// ============================================
// ADMIN SERVICES
// ============================================
let adminServicesCurrentPage = 1;

$(document).ready(function() {
    // Only initialize services page if we're on the services page
    if ($('#servicesTableBody').length > 0 || $('#servicesGridBody').length > 0) {
        checkAdminAuth();
        loadServices();
        
        $('#searchInput').on('keyup', function(e) {
            if (e.key === 'Enter') {
                loadServices();
            }
        });

        $('#logoutLink').on('click', function(e) {
            e.preventDefault();
            Swal.fire({
                title: 'Are you sure?',
                text: 'Do you want to logout?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, logout!'
            }).then((result) => {
                if (result.isConfirmed) {
                    logout();
                }
            });
        });

        // Clear previews when modal is hidden
        $('#serviceModal').on('hidden.bs.modal', function() {
            $('#imagePreview').hide();
            $('#currentImage').hide();
            $('#previewImg').attr('src', '');
            $('#currentImg').attr('src', '');
        });
    }
});

function loadServices(page = 1) {
    adminServicesCurrentPage = page;
    const searchQuery = $('#searchInput').val();
    const params = new URLSearchParams({ page: page });
    if (searchQuery) params.append('search', searchQuery);

    axios.get(`${API_BASE_URL}/api/services?${params}`)
        .then(function(response) {
            if (response.data.success) {
                displayServices(response.data.data);
                displayServicesPagination(response.data.data);
            }
        })
        .catch(function(error) {
            console.error('Error loading services:', error);
            $('#servicesTableBody').html('<tr><td colspan="8" class="text-center text-danger">Error loading services</td></tr>');
            $('#servicesGridBody').html('<div class="col-12 text-center text-danger">Error loading services</div>');
        });
}

function displayServices(data) {
    const tbody = $('#servicesTableBody');
    const gridBody = $('#servicesGridBody');
    tbody.empty();
    gridBody.empty();

    if (data.data.length === 0) {
        tbody.html('<tr><td colspan="8" class="text-center">No services found</td></tr>');
        gridBody.html('<div class="col-12 text-center">No services found</div>');
        return;
    }

    data.data.forEach(service => {
        let imageUrl;
        if (service.image && service.image !== 'defaults/service-default.png' && service.image !== 'defaults/service-default.svg') {
            imageUrl = `${API_BASE_URL}/storage/${service.image}`;
        } else {
            // Try PNG first, fallback to SVG
            imageUrl = `${API_BASE_URL}/storage/defaults/service-default.png`;
        }
        
        // Table row for desktop
        const row = `
            <tr>
                <td>${service.id}</td>
                <td>
                    <img src="${imageUrl}" alt="${service.name}" 
                         style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;" 
                         onerror="this.onerror=null; this.src='${API_BASE_URL}/storage/defaults/service-default.svg'">
                </td>
                <td>${service.name}</td>
                <td>${service.description || '-'}</td>
                <td>₱${parseFloat(service.price).toFixed(2)}</td>
                <td>${service.duration_minutes} min</td>
                <td>${service.active ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-danger">Inactive</span>'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editService(${service.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteService(${service.id})"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `;
        tbody.append(row);

        // Grid card for mobile
        const card = `
            <div class="col-12">
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex align-items-start mb-3">
                            <img src="${imageUrl}" alt="${service.name}" 
                                 class="me-3" 
                                 style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; flex-shrink: 0;" 
                                 onerror="this.onerror=null; this.src='${API_BASE_URL}/storage/defaults/service-default.svg'">
                            <div class="flex-grow-1">
                                <h5 class="card-title mb-1">${service.name}</h5>
                                <p class="text-muted small mb-2">ID: ${service.id}</p>
                                ${service.active ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-danger">Inactive</span>'}
                            </div>
                        </div>
                        <p class="card-text mb-2">${service.description || '<span class="text-muted">No description</span>'}</p>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <strong class="text-primary">₱${parseFloat(service.price).toFixed(2)}</strong>
                                <span class="text-muted ms-2">${service.duration_minutes} min</span>
                            </div>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-primary flex-fill" onclick="editService(${service.id})">
                                <i class="bi bi-pencil"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-danger flex-fill" onclick="deleteService(${service.id})">
                                <i class="bi bi-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        gridBody.append(card);
    });
}

function displayServicesPagination(data) {
    const nav = $('#paginationNav');
    const navMobile = $('#paginationNavMobile');
    nav.empty();
    navMobile.empty();
    if (data.last_page <= 1) return;

    let pagination = '<ul class="pagination">';
    pagination += `<li class="page-item ${data.current_page === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="loadServices(${data.current_page - 1}); return false;">Previous</a>
    </li>`;
    for (let i = 1; i <= data.last_page; i++) {
        pagination += `<li class="page-item ${i === data.current_page ? 'active' : ''}">
            <a class="page-link" href="#" onclick="loadServices(${i}); return false;">${i}</a>
        </li>`;
    }
    pagination += `<li class="page-item ${data.current_page === data.last_page ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="loadServices(${data.current_page + 1}); return false;">Next</a>
    </li>`;
    pagination += '</ul>';
    nav.html(pagination);
    navMobile.html(pagination);
}

function openServiceModal() {
    $('#serviceModalTitle').text('Add Service');
    $('#serviceForm')[0].reset();
    $('#serviceId').val('');
    $('#image').val(''); // Clear file input
    $('#imagePreview').hide();
    $('#currentImage').hide();
}

function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            $('#previewImg').attr('src', e.target.result);
            $('#imagePreview').show();
            $('#currentImage').hide(); // Hide current image when new one is selected
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        $('#imagePreview').hide();
    }
}

function editService(id) {
    axios.get(`${API_BASE_URL}/api/services/${id}`)
        .then(function(response) {
            if (response.data.success) {
                const service = response.data.data;
                $('#serviceModalTitle').text('Edit Service');
                $('#serviceId').val(service.id);
                $('#name').val(service.name);
                $('#description').val(service.description);
                $('#price').val(service.price);
                $('#duration_minutes').val(service.duration_minutes);
                $('#active').prop('checked', service.active);
                $('#image').val(''); // Clear file input
                
                // Show current image
                if (service.image) {
                    const currentImageUrl = `${API_BASE_URL}/storage/${service.image}`;
                    $('#currentImg').attr('src', currentImageUrl);
                    $('#currentImage').show();
                } else {
                    const defaultImageUrl = `${API_BASE_URL}/storage/defaults/service-default.svg`;
                    $('#currentImg').attr('src', defaultImageUrl);
                    $('#currentImage').show();
                }
                $('#imagePreview').hide();
                
                $('#serviceModal').modal('show');
            }
        })
        .catch(function(error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error loading service'
            });
        });
}

function saveService() {
    const serviceId = $('#serviceId').val();
    const formData = new FormData();
    
    formData.append('name', $('#name').val());
    formData.append('description', $('#description').val());
    formData.append('price', $('#price').val());
    formData.append('duration_minutes', $('#duration_minutes').val());
    formData.append('active', $('#active').is(':checked') ? 1 : 0);
    
    const imageFile = $('#image')[0].files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    const url = serviceId ? `${API_BASE_URL}/api/services/${serviceId}` : `${API_BASE_URL}/api/services`;
    
    // For PUT requests with file uploads, use POST with _method override
    if (serviceId) {
        formData.append('_method', 'PUT');
        axios.post(url, formData, {
            headers: { 
                'Content-Type': 'multipart/form-data'
            }
        })
        .then(function(response) {
            if (response.data.success) {
                $('#serviceModal').modal('hide');
                $('#serviceForm')[0].reset();
                loadServices(adminServicesCurrentPage);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Service saved successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        })
        .catch(function(error) {
            console.error('Error saving service:', error);
            const message = error.response?.data?.message || error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : 'Error saving service';
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: message
            });
        });
    } else {
        // POST for new services
        axios.post(url, formData, {
            headers: { 
                'Content-Type': 'multipart/form-data'
            }
        })
        .then(function(response) {
            if (response.data.success) {
                $('#serviceModal').modal('hide');
                $('#serviceForm')[0].reset();
                loadServices(adminServicesCurrentPage);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Service saved successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        })
        .catch(function(error) {
            console.error('Error saving service:', error);
            const message = error.response?.data?.message || error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : 'Error saving service';
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: message
            });
        });
    }
}

function deleteService(id) {
    Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
        if (result.isConfirmed) {
            axios.delete(`${API_BASE_URL}/api/services/${id}`)
                .then(function(response) {
                    if (response.data.success) {
                        loadServices(adminServicesCurrentPage);
                        Swal.fire({
                            icon: 'success',
                            title: 'Deleted!',
                            text: 'Service deleted successfully',
                            timer: 2000,
                            showConfirmButton: false
                        });
                    }
                })
                .catch(function(error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Error deleting service'
                    });
                });
        }
    });
}

// ============================================
// ADMIN BOOKINGS
// ============================================
let adminBookingsCurrentPage = 1;

$(document).ready(function() {
    // Only initialize bookings page if we're on the bookings page
    if ($('#bookingsTableBody').length > 0 || $('#bookingsGridBody').length > 0) {
        // Check if this is admin bookings page (not therapist or client)
        const user = getCurrentUser();
        if (user && user.user_type === 'admin') {
            checkAdminAuth();
            loadAdminBookings();
            
            $('#logoutLink').on('click', function(e) {
                e.preventDefault();
                logout();
            });
        }
    }
});

function loadAdminBookings(page = 1) {
    adminBookingsCurrentPage = page;
    const params = new URLSearchParams({ page: page });
    
    const search = $('#searchInput').val();
    const status = $('#statusFilter').val();
    
    if (search) params.append('search', search);
    if (status) params.append('status', status);

    axios.get(`${API_BASE_URL}/api/bookings?${params}`)
        .then(function(response) {
            if (response.data.success) {
                displayAdminBookings(response.data.data);
                displayAdminBookingsPagination(response.data.data);
            }
        })
        .catch(function(error) {
            console.error('Error loading bookings:', error);
            $('#bookingsTableBody').html('<tr><td colspan="7" class="text-center text-danger">Error loading bookings</td></tr>');
            $('#bookingsGridBody').html('<div class="col-12 text-center text-danger">Error loading bookings</div>');
        });
}

function displayAdminBookings(data) {
    const tbody = $('#bookingsTableBody');
    const gridBody = $('#bookingsGridBody');
    tbody.empty();
    gridBody.empty();

    if (data.data.length === 0) {
        tbody.html('<tr><td colspan="7" class="text-center">No bookings found</td></tr>');
        gridBody.html('<div class="col-12 text-center">No bookings found</div>');
        return;
    }

    data.data.forEach(booking => {
        const statusBadges = {
            'pending': 'warning',
            'approved': 'success',
            'rejected': 'danger',
            'completed': 'info',
            'expired': 'secondary',
            'cancelled': 'dark'
        };
        const badgeClass = statusBadges[booking.status] || 'secondary';
        
        // Table row for desktop
        const row = `
            <tr>
                <td>${booking.id}</td>
                <td>${booking.client.firstname} ${booking.client.lastname}</td>
                <td>${booking.therapist.firstname} ${booking.therapist.lastname}</td>
                <td>${booking.service.name}</td>
                <td>${new Date(booking.booking_date).toLocaleDateString()}</td>
                <td>${booking.booking_time}</td>
                <td><span class="badge bg-${badgeClass}">${booking.status}</span></td>
            </tr>
        `;
        tbody.append(row);

        // Grid card for mobile
        const card = `
            <div class="col-12">
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <h5 class="card-title mb-1">Booking #${booking.id}</h5>
                                <span class="badge bg-${badgeClass}">${booking.status}</span>
                            </div>
                        </div>
                        <hr class="my-2">
                        <div class="mb-2">
                            <small class="text-muted d-block">Service</small>
                            <strong>${booking.service.name}</strong>
                        </div>
                        <div class="mb-2">
                            <small class="text-muted d-block">Client</small>
                            <strong>${booking.client.firstname} ${booking.client.lastname}</strong>
                        </div>
                        <div class="mb-2">
                            <small class="text-muted d-block">Therapist</small>
                            <strong>${booking.therapist.firstname} ${booking.therapist.lastname}</strong>
                        </div>
                        <div class="mb-2">
                            <small class="text-muted d-block">Date & Time</small>
                            <strong>${new Date(booking.booking_date).toLocaleDateString()} at ${booking.booking_time}</strong>
                        </div>
                    </div>
                </div>
            </div>
        `;
        gridBody.append(card);
    });
}

function displayAdminBookingsPagination(data) {
    const nav = $('#paginationNav');
    const navMobile = $('#paginationNavMobile');
    nav.empty();
    navMobile.empty();
    if (data.last_page <= 1) return;

    let pagination = '<ul class="pagination">';
    pagination += `<li class="page-item ${data.current_page === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="loadAdminBookings(${data.current_page - 1}); return false;">Previous</a>
    </li>`;
    for (let i = 1; i <= data.last_page; i++) {
        pagination += `<li class="page-item ${i === data.current_page ? 'active' : ''}">
            <a class="page-link" href="#" onclick="loadAdminBookings(${i}); return false;">${i}</a>
        </li>`;
    }
    pagination += `<li class="page-item ${data.current_page === data.last_page ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="loadAdminBookings(${data.current_page + 1}); return false;">Next</a>
    </li>`;
    pagination += '</ul>';
    nav.html(pagination);
    navMobile.html(pagination);
}

// ============================================
// WRAPPER FUNCTIONS FOR COMPATIBILITY
// ============================================
// Wrapper for admin bookings page (called from HTML onclick)
function loadBookings(page) {
    const user = getCurrentUser();
    if (user && user.user_type === 'admin') {
        loadAdminBookings(page || 1);
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function getStatusBadge(status) {
    const badges = {
        'pending': 'warning',
        'approved': 'success',
        'rejected': 'danger',
        'completed': 'info',
        'expired': 'secondary',
        'cancelled': 'dark'
    };
    return badges[status] || 'secondary';
}

function getUserTypeBadge(type) {
    const badges = {
        'admin': 'danger',
        'therapist': 'info',
        'client': 'primary'
    };
    return badges[type] || 'secondary';
}
