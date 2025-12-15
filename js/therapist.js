// ============================================
// THERAPIST DASHBOARD
// ============================================
$(document).ready(function() {
    // Only initialize dashboard if we're on the dashboard page
    if ($('#todayAppointments').length > 0) {
        const user = getCurrentUser();
        
        if (!user || !isAuthenticated() || user.user_type !== 'therapist') {
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
        loadTherapistDashboardStats();
    }
});

function loadTherapistDashboardStats() {
    if ($('#todayAppointments').length === 0) return; // Only run on dashboard page
    
    const today = new Date().toISOString().split('T')[0];
    
    // Load today's appointments
    axios.get(`${API_BASE_URL}/api/bookings?date_from=${today}&date_to=${today}&per_page=1`)
        .then(function(response) {
            if (response.data.success) {
                $('#todayAppointments').text(response.data.data.total || 0);
            }
        })
        .catch(function(error) {
            console.error('Error loading today appointments:', error);
        });

    // Load pending appointments
    axios.get(`${API_BASE_URL}/api/bookings?status=pending&per_page=1`)
        .then(function(response) {
            if (response.data.success) {
                $('#pendingAppointments').text(response.data.data.total || 0);
            }
        })
        .catch(function(error) {
            console.error('Error loading pending appointments:', error);
        });

    // Load approved appointments
    axios.get(`${API_BASE_URL}/api/bookings?status=approved&per_page=1`)
        .then(function(response) {
            if (response.data.success) {
                $('#approvedAppointments').text(response.data.data.total || 0);
            }
        })
        .catch(function(error) {
            console.error('Error loading approved appointments:', error);
        });

    // Load total unique clients - fetch all bookings to get accurate count
    function loadTotalClients(page = 1, allBookings = []) {
        axios.get(`${API_BASE_URL}/api/bookings?per_page=100&page=${page}`)
            .then(function(response) {
                if (response.data.success) {
                    const bookings = response.data.data.data || [];
                    allBookings = allBookings.concat(bookings);
                    
                    // If there are more pages, fetch them
                    if (response.data.data.current_page < response.data.data.last_page) {
                        loadTotalClients(page + 1, allBookings);
                    } else {
                        // All bookings loaded, count unique clients
                        const uniqueClientIds = new Set();
                        allBookings.forEach(booking => {
                            if (booking.client && booking.client.id) {
                                uniqueClientIds.add(booking.client.id);
                            }
                        });
                        $('#totalClients').text(uniqueClientIds.size);
                    }
                }
            })
            .catch(function(error) {
                console.error('Error loading total clients:', error);
                // If error, at least try to count from what we have
                if (allBookings.length > 0) {
                    const uniqueClientIds = new Set();
                    allBookings.forEach(booking => {
                        if (booking.client && booking.client.id) {
                            uniqueClientIds.add(booking.client.id);
                        }
                    });
                    $('#totalClients').text(uniqueClientIds.size);
                }
            });
    }
    loadTotalClients();

    // Load today's appointments list
    axios.get(`${API_BASE_URL}/api/bookings?date_from=${today}&date_to=${today}&per_page=10`)
        .then(function(response) {
            if (response.data.success && response.data.data.data.length > 0) {
                const tbody = $('#appointmentsTableBody');
                tbody.empty();
                response.data.data.data.forEach(booking => {
                    const statusBadges = {
                        'pending': 'warning',
                        'approved': 'success',
                        'rejected': 'danger',
                        'completed': 'info'
                    };
                    const badgeClass = statusBadges[booking.status] || 'secondary';
                    
                    tbody.append(`
                        <tr>
                            <td>${booking.client.firstname} ${booking.client.lastname}</td>
                            <td>${booking.service.name}</td>
                            <td>${booking.booking_time}</td>
                            <td><span class="badge bg-${badgeClass}">${booking.status}</span></td>
                            <td>
                                ${booking.status === 'pending' ? `
                                    <button class="btn btn-sm btn-success" onclick="window.location.href='therapist-bookings.html'">
                                        <i class="bi bi-check"></i> Manage
                                    </button>
                                ` : '-'}
                            </td>
                        </tr>
                    `);
                });
            }
        })
        .catch(function(error) {
            console.error('Error loading today appointments:', error);
        });
}

// ============================================
// THERAPIST BOOKINGS
// ============================================
let therapistBookingsCurrentPage = 1;

$(document).ready(function() {
    // Only initialize bookings page if we're on the bookings page
    if ($('#bookingsTableBody').length > 0 || $('#bookingsGridBody').length > 0) {
        // Check if this is therapist bookings page
        const user = getCurrentUser();
        if (user && user.user_type === 'therapist') {
            checkTherapistAuth();
            loadTherapistBookings();
            
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
    }
});

function checkTherapistAuth() {
    const user = getCurrentUser();
    if (!user || !isAuthenticated() || user.user_type !== 'therapist') {
        window.location.href = 'login.html';
    }
}

function loadTherapistBookings(page = 1) {
    therapistBookingsCurrentPage = page;
    const params = new URLSearchParams({ page: page });
    
    const search = $('#searchInput').val();
    const status = $('#statusFilter').val();
    
    if (search) params.append('search', search);
    if (status) params.append('status', status);

    axios.get(`${API_BASE_URL}/api/bookings?${params}`)
        .then(function(response) {
            if (response.data.success) {
                displayTherapistBookings(response.data.data);
                displayTherapistBookingsPagination(response.data.data);
            }
        })
        .catch(function(error) {
            console.error('Error loading bookings:', error);
            $('#bookingsTableBody').html('<tr><td colspan="7" class="text-center text-danger">Error loading bookings</td></tr>');
            $('#bookingsGridBody').html('<div class="col-12 text-center text-danger">Error loading bookings</div>');
        });
}

function displayTherapistBookings(data) {
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
        
        let actionButtons = '';
        let mobileActionButtons = '';
        if (booking.status === 'pending') {
            actionButtons = `
                <button class="btn btn-sm btn-success" onclick="updateBookingStatus(${booking.id}, 'approved')">
                    <i class="bi bi-check"></i> Approve
                </button>
                <button class="btn btn-sm btn-danger" onclick="updateBookingStatus(${booking.id}, 'rejected')">
                    <i class="bi bi-x"></i> Reject
                </button>
            `;
            mobileActionButtons = `
                <button class="btn btn-sm btn-success flex-fill" onclick="updateBookingStatus(${booking.id}, 'approved')">
                    <i class="bi bi-check"></i> Approve
                </button>
                <button class="btn btn-sm btn-danger flex-fill" onclick="updateBookingStatus(${booking.id}, 'rejected')">
                    <i class="bi bi-x"></i> Reject
                </button>
            `;
        } else if (booking.status === 'approved') {
            actionButtons = `
                <button class="btn btn-sm btn-info" onclick="updateBookingStatus(${booking.id}, 'completed')">
                    <i class="bi bi-check-circle"></i> Complete
                </button>
            `;
            mobileActionButtons = `
                <button class="btn btn-sm btn-info w-100" onclick="updateBookingStatus(${booking.id}, 'completed')">
                    <i class="bi bi-check-circle"></i> Complete
                </button>
            `;
        } else {
            actionButtons = '<span class="text-muted">No actions</span>';
            mobileActionButtons = '<span class="text-muted">No actions available</span>';
        }
        
        // Table row for desktop
        const row = `
            <tr>
                <td>${booking.id}</td>
                <td>${booking.client.firstname} ${booking.client.lastname}</td>
                <td>${booking.service.name}</td>
                <td>${new Date(booking.booking_date).toLocaleDateString()}</td>
                <td>${booking.booking_time}</td>
                <td><span class="badge bg-${badgeClass}">${booking.status}</span></td>
                <td>${actionButtons}</td>
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
                        <div class="mb-3">
                            <small class="text-muted d-block">Date & Time</small>
                            <strong>${new Date(booking.booking_date).toLocaleDateString()} at ${booking.booking_time}</strong>
                        </div>
                        <div class="d-flex gap-2">
                            ${mobileActionButtons}
                        </div>
                    </div>
                </div>
            </div>
        `;
        gridBody.append(card);
    });
}

function updateBookingStatus(bookingId, newStatus) {
    Swal.fire({
        title: 'Are you sure?',
        text: `Are you sure you want to ${newStatus} this booking?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: `Yes, ${newStatus} it!`
    }).then((result) => {
        if (result.isConfirmed) {
            axios.put(`${API_BASE_URL}/api/bookings/${bookingId}/status`, { status: newStatus })
                .then(function(response) {
                    if (response.data.success) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Booking status updated successfully',
                            timer: 2000,
                            showConfirmButton: false
                        });
                        loadTherapistBookings(therapistBookingsCurrentPage);
                    }
                })
                .catch(function(error) {
                    const message = error.response?.data?.message || 'Error updating booking status';
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: message
                    });
                });
        }
    });
}

function displayTherapistBookingsPagination(data) {
    const nav = $('#paginationNav');
    const navMobile = $('#paginationNavMobile');
    nav.empty();
    navMobile.empty();
    if (data.last_page <= 1) return;

    let pagination = '<ul class="pagination">';
    pagination += `<li class="page-item ${data.current_page === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="loadTherapistBookings(${data.current_page - 1}); return false;">Previous</a>
    </li>`;
    for (let i = 1; i <= data.last_page; i++) {
        pagination += `<li class="page-item ${i === data.current_page ? 'active' : ''}">
            <a class="page-link" href="#" onclick="loadTherapistBookings(${i}); return false;">${i}</a>
        </li>`;
    }
    pagination += `<li class="page-item ${data.current_page === data.last_page ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="loadTherapistBookings(${data.current_page + 1}); return false;">Next</a>
    </li>`;
    pagination += '</ul>';
    nav.html(pagination);
    navMobile.html(pagination);
}

// ============================================
// WRAPPER FUNCTIONS FOR COMPATIBILITY
// ============================================
// Wrapper for therapist bookings page (called from HTML onclick)
function loadBookings(page) {
    const user = getCurrentUser();
    if (user && user.user_type === 'therapist') {
        loadTherapistBookings(page || 1);
    }
}
