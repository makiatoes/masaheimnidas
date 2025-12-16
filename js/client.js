// ============================================
// CLIENT DASHBOARD
// ============================================
$(document).ready(function() {
    // Only initialize dashboard if we're on the dashboard page
    if ($('#totalBookings').length > 0 && $('#bookingsTableBody').length > 0) {
        const user = getCurrentUser();
        
        if (!user || !isAuthenticated() || user.user_type !== 'client') {
            window.location.href = 'login.html';
            return;
        }

        
        const fullName = (user.firstname || '') + ' ' + (user.lastname || '');
        $('#userFullName').text(fullName.trim() || user.username);
        $('#navUserName').text(user.username);

        // Logout functionality
        $('#logoutLink').on('click', function(e) {
            e.preventDefault();
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
        });

        // Quick action button for "Book your first service!" link
        $('#bookFirstService').on('click', function() {
            window.location.href = 'client-booking.html';
        });

        // Load dashboard stats
        loadClientDashboardStats();
    }
});

function loadClientDashboardStats() {
    if ($('#totalBookings').length === 0) return; // Only run on dashboard page
    
    // Load total bookings
    axios.get(`${API_BASE_URL}/api/bookings?per_page=1`)
        .then(function(response) {
            if (response.data.success) {
                $('#totalBookings').text(response.data.data.total || 0);
            }
        })
        .catch(function(error) {
            console.error('Error loading bookings count:', error);
        });

    // Load approved bookings
    axios.get(`${API_BASE_URL}/api/bookings?status=approved&per_page=1`)
        .then(function(response) {
            if (response.data.success) {
                $('#approvedBookings').text(response.data.data.total || 0);
            }
        })
        .catch(function(error) {
            console.error('Error loading approved bookings:', error);
        });

    // Load pending bookings
    axios.get(`${API_BASE_URL}/api/bookings?status=pending&per_page=1`)
        .then(function(response) {
            if (response.data.success) {
                $('#pendingBookings').text(response.data.data.total || 0);
            }
        })
        .catch(function(error) {
            console.error('Error loading pending bookings:', error);
        });

    // Load recent bookings
    axios.get(`${API_BASE_URL}/api/bookings?per_page=5`)
        .then(function(response) {
            if (response.data.success && response.data.data.data.length > 0) {
                const tbody = $('#bookingsTableBody');
                tbody.empty();
                response.data.data.data.forEach(booking => {
                    const statusBadges = {
                        'pending': 'warning',
                        'approved': 'success',
                        'rejected': 'danger',
                        'completed': 'info',
                        'expired': 'secondary',
                        'cancelled': 'dark'
                    };
                    const badgeClass = statusBadges[booking.status] || 'secondary';
                    
                    let actionButton = '';
                    if (booking.status === 'pending') {
                        actionButton = `<button class="btn btn-sm btn-danger" onclick="window.location.href='client-bookings.html'">Cancel</button>`;
                    } else {
                        actionButton = '-';
                    }
                    
                    tbody.append(`
                        <tr>
                            <td>${booking.service.name}</td>
                            <td>${booking.therapist.firstname} ${booking.therapist.lastname}</td>
                            <td>${new Date(booking.booking_date).toLocaleDateString()}</td>
                            <td>${booking.booking_time}</td>
                            <td><span class="badge bg-${badgeClass}">${booking.status}</span></td>
                            <td>${actionButton}</td>
                        </tr>
                    `);
                });
            } else {
                $('#bookingsTableBody').html('<tr><td colspan="6" class="text-center text-muted">No bookings yet. <a href="client-booking.html">Book your first service!</a></td></tr>');
            }
        })
        .catch(function(error) {
            console.error('Error loading recent bookings:', error);
        });
}

// ============================================
// CLIENT BOOKING (Create Booking Page)
// ============================================
let selectedService = null;
let selectedTherapist = null;
let allServices = [];

$(document).ready(function() {
    // Only initialize booking page if we're on the booking page
    if ($('#servicesGrid').length > 0) {
        checkClientAuth();
        loadClientServices();
        loadTherapists();
        
        // Treat "today/tomorrow" as UTC+8 calendar dates (matches backend APP_TIMEZONE=Asia/Manila).
        const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        function dateStringUTC8(epochMs = Date.now()) {
            return new Date(epochMs + UTC8_OFFSET_MS).toISOString().split('T')[0];
        }

        function getTodayDateUTC8() {
            return dateStringUTC8();
        }
        
        function getTomorrowDateUTC8() {
            return dateStringUTC8(Date.now() + ONE_DAY_MS);
        }
        
        // Get date input element (declare once)
        const dateInput = document.getElementById('booking_date');
        
        function validateBookingDate() {
            const selectedDate = $('#booking_date').val();
            
            if (!selectedDate) {
                return true; // Allow empty date
            }
            
            const tomorrowStr = getTomorrowDateUTC8();
            
            // Strict validation (UTC+8): reject today or any past date
            if (selectedDate < tomorrowStr) {
                if (dateInput) {
                    dateInput.value = ''; // Clear using native method
                    $('#booking_date').val(''); // Also clear using jQuery
                    dateInput.setAttribute('value', ''); // Clear attribute
                    
                    // Show alert with SweetAlert
                    Swal.fire({
                        icon: 'warning',
                        title: 'Invalid Date',
                        text: 'You cannot book for today. Please select a date starting from tomorrow.'
                    });
                    
                    // Re-focus the field to show the picker again
                    setTimeout(() => {
                        if (dateInput) {
                            dateInput.focus();
                        }
                    }, 100);
                }
                
                return false;
            }
            
            return true;
        }
        
        // Set minimum date to tomorrow immediately (this disables today and all past dates)
        const setMinDate = function() {
            const tomorrowStr = getTomorrowDateUTC8();
            
            if (dateInput) {
                // Set min attribute multiple ways to ensure it sticks
                dateInput.setAttribute('min', tomorrowStr);
                dateInput.min = tomorrowStr;
                $(dateInput).attr('min', tomorrowStr);
            }
        };
        
        // Set min date on page load IMMEDIATELY (disable today)
        // This must run before any user interaction
        if (dateInput) {
            const tomorrowStr = getTomorrowDateUTC8();
            dateInput.setAttribute('min', tomorrowStr);
            dateInput.min = tomorrowStr;
        }
        
        // Set min date on page load
        setMinDate();
        
        // Intercept date selection before it happens - set min every time
        $('#booking_date').on('focus', function() {
            setMinDate(); // Update min date when field is focused
            // Also set it using native method
            if (dateInput) {
                const tomorrowStr = getTomorrowDateUTC8();
                dateInput.setAttribute('min', tomorrowStr);
                dateInput.min = tomorrowStr;
            }
        });
        
        // Also set min when clicking on the input
        $('#booking_date').on('click', function() {
            setMinDate();
            if (dateInput) {
                const tomorrowStr = getTomorrowDateUTC8();
                dateInput.setAttribute('min', tomorrowStr);
                dateInput.min = tomorrowStr;
            }
        });
        
        // Validate on input (catches immediate changes, including typing)
        $('#booking_date').on('input', function(e) {
            const selectedDate = $(this).val();
            if (selectedDate) {
                // Validate immediately
                const tomorrowStr = getTomorrowDateUTC8();
                
                if (selectedDate < tomorrowStr) {
                    e.preventDefault();
                    e.stopPropagation();
                    $(this).val('');
                    validateBookingDate();
                    return false;
                }
            }
        });
        
        // Validate on change (catches when date picker closes or value changes)
        $('#booking_date').on('change', function(e) {
            const selectedDate = $(this).val();
            if (selectedDate) {
                const tomorrowStr = getTomorrowDateUTC8();
                
                if (selectedDate < tomorrowStr) {
                    e.preventDefault();
                    e.stopPropagation();
                    $(this).val('');
                    validateBookingDate();
                    return false;
                }
                
                // If date is valid and therapist is selected, load available time slots
                if ($('#therapist_id').val()) {
                    loadAvailableTimeSlots();
                }
            }
        });
        
        // Additional validation on click (before picker opens)
        $('#booking_date').on('click', function() {
            setMinDate(); // Ensure min is set before picker opens
        });
        
        // Catch invalid date using HTML5 validation
        $('#booking_date').on('invalid', function(e) {
            e.preventDefault();
            validateBookingDate();
        });
        
        // Validate on blur (when user leaves the field)
        $('#booking_date').on('blur', function() {
            if ($(this).val()) {
                validateBookingDate();
            }
        });
        
        // Validate when modal is shown (reset if invalid and update min)
        $('#bookingModal').on('shown.bs.modal', function() {
            // Update min date every time modal opens (in case date changed)
            setMinDate();
            
            // Validate and clear if invalid
            const selectedDate = $('#booking_date').val();
            if (selectedDate) {
                const tomorrowStr = getTomorrowDateUTC8();
                
                if (selectedDate < tomorrowStr) {
                    $('#booking_date').val('');
                    if (dateInput) {
                        dateInput.value = '';
                        dateInput.setAttribute('value', '');
                    }
                    validateBookingDate();
                }
            }
        });
        
        // Also validate on every interaction with the date field
        $('#booking_date').on('keyup', function() {
            if ($(this).val()) {
                setTimeout(() => validateBookingDate(), 0);
            }
        });
        
        // Additional check: monitor for any value changes using MutationObserver
        if (dateInput) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                        setTimeout(() => {
                            if ($('#booking_date').val()) {
                                validateBookingDate();
                            }
                        }, 0);
                    }
                });
            });
            
            // Observe the input element
            observer.observe(dateInput, {
                attributes: true,
                attributeFilter: ['value']
            });
        }

        // Search functionality
        $('#searchInput').on('input', function() {
            filterAndDisplayServices();
        });

        // Sort functionality
        $('#sortSelect').on('change', function() {
            filterAndDisplayServices();
        });

        // Price filter functionality
        $('#priceFilter').on('change', function() {
            filterAndDisplayServices();
        });

        // Clear filters
        $('#clearFiltersBtn').on('click', function() {
            $('#searchInput').val('');
            $('#sortSelect').val('name-asc');
            $('#priceFilter').val('all');
            filterAndDisplayServices();
        });

        $('#therapist_id').on('change', function() {
            selectedTherapist = $(this).find(':selected').data('therapist');
            // Only load time slots if a valid date is selected
            const selectedDate = $('#booking_date').val();
            const tomorrowStr = getTomorrowDateUTC8();
            if (selectedDate && selectedDate >= tomorrowStr) {
                loadAvailableTimeSlots();
            }
        });

        $('#submitBookingBtn').on('click', function() {
            createBooking();
        });

        // Reset form when modal is closed
        $('#bookingModal').on('hidden.bs.modal', function() {
            resetBookingForm();
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

function checkClientAuth() {
    const user = getCurrentUser();
    if (!user || !isAuthenticated() || user.user_type !== 'client') {
        window.location.href = 'login.html';
    }
}

function openBookingModal(service) {
    selectedService = service;
    
    // Set service ID
    $('#service_id').val(service.id);
    
    // Populate service info in modal
    // Use default image if no image is set
    let imageUrl;
    // Check if service has a valid custom image
    if (service.image && 
        service.image !== 'defaults/service-default.png' && 
        service.image !== 'defaults/service-default.svg' &&
        service.image.trim() !== '') {
        imageUrl = `${API_BASE_URL}/storage/${service.image}`;
    } else {
        // Use default image
        imageUrl = `${API_BASE_URL}/storage/defaults/service-default.png`;
    }

    $('#modalServiceInfo').html(`
        <div class="row align-items-center">
            <div class="col-md-3">
                <img src="${imageUrl}" class="img-fluid rounded" alt="${service.name}" style="max-height: 150px; object-fit: cover; background-color: #e9ecef;" onerror="this.onerror=null; this.src='${API_BASE_URL}/storage/defaults/service-default.svg'">
            </div>
            <div class="col-md-9">
                <h5 class="mb-2">${service.name}</h5>
                <p class="text-muted mb-2">${service.description || 'No description available'}</p>
                <p class="mb-1"><strong class="text-primary">₱${parseFloat(service.price).toFixed(2)}</strong></p>
                <p class="text-muted small mb-0"><i class="bi bi-clock"></i> ${service.duration_minutes} minutes</p>
            </div>
        </div>
    `);
    
    // Reset form
    resetBookingForm();
    
    // Reload therapists to ensure they're available
    loadTherapists();
    
    // Open modal
    const modal = new bootstrap.Modal(document.getElementById('bookingModal'));
    modal.show();
}

function resetBookingForm() {
    $('#therapist_id').val('');
    $('#booking_date').val('');
    $('#booking_time').html('<option value="">Choose a time...</option>');
    $('#errorMessage').addClass('d-none').text('');
    selectedTherapist = null;
}

function loadClientServices() {
    axios.get(`${API_BASE_URL}/api/services`)
        .then(function(response) {
            if (response.data.success) {
                const services = response.data.data.data || response.data.data || [];
                
                // Store all active services
                allServices = services.filter(service => service.active);
                
                // Display services with filters
                filterAndDisplayServices();
            }
        })
        .catch(function(error) {
            console.error('Error loading services:', error);
            $('#servicesGrid').html('<div class="col-12"><p class="text-danger text-center">Error loading services. Please try again.</p></div>');
        });
}

function filterAndDisplayServices() {
    const grid = $('#servicesGrid');
    grid.empty();
    
    if (allServices.length === 0) {
        grid.html('<div class="col-12"><p class="text-muted text-center">No services available</p></div>');
        $('#resultsCount').text('');
        return;
    }

    // Get filter values
    const searchTerm = $('#searchInput').val().toLowerCase().trim();
    const priceFilter = $('#priceFilter').val();
    const sortBy = $('#sortSelect').val();

    // Filter services
    let filteredServices = allServices.filter(service => {
        // Search filter
        const matchesSearch = !searchTerm || 
            service.name.toLowerCase().includes(searchTerm) ||
            (service.description && service.description.toLowerCase().includes(searchTerm));

        // Price filter
        let matchesPrice = true;
        if (priceFilter !== 'all') {
            const price = parseFloat(service.price);
            switch(priceFilter) {
                case '0-500':
                    matchesPrice = price >= 0 && price <= 500;
                    break;
                case '500-1000':
                    matchesPrice = price > 500 && price <= 1000;
                    break;
                case '1000-2000':
                    matchesPrice = price > 1000 && price <= 2000;
                    break;
                case '2000+':
                    matchesPrice = price > 2000;
                    break;
            }
        }

        return matchesSearch && matchesPrice;
    });

    // Sort services
    filteredServices.sort((a, b) => {
        switch(sortBy) {
            case 'name-asc':
                return a.name.localeCompare(b.name);
            case 'name-desc':
                return b.name.localeCompare(a.name);
            case 'price-asc':
                return parseFloat(a.price) - parseFloat(b.price);
            case 'price-desc':
                return parseFloat(b.price) - parseFloat(a.price);
            case 'duration-asc':
                return (a.duration_minutes || 0) - (b.duration_minutes || 0);
            case 'duration-desc':
                return (b.duration_minutes || 0) - (a.duration_minutes || 0);
            default:
                return 0;
        }
    });

    // Update results count
    const count = filteredServices.length;
    $('#resultsCount').text(`Showing ${count} of ${allServices.length} service${allServices.length !== 1 ? 's' : ''}`);

    // Display filtered services
    if (filteredServices.length === 0) {
        grid.html('<div class="col-12"><p class="text-muted text-center">No services match your search criteria</p></div>');
        return;
    }

    filteredServices.forEach(service => {
        // Use default image if no image is set
        let imageUrl;
        // Check if service has a valid custom image
        if (service.image && 
            service.image !== 'defaults/service-default.png' && 
            service.image !== 'defaults/service-default.svg' &&
            service.image.trim() !== '') {
            imageUrl = `${API_BASE_URL}/storage/${service.image}`;
        } else {
            // Use default image
            imageUrl = `${API_BASE_URL}/storage/defaults/service-default.png`;
        }
        
        const serviceCard = $(`
            <div class="col-md-4 col-sm-6">
                <div class="card h-100 service-card" data-service-id="${service.id}" style="transition: transform 0.2s;">
                    <img src="${imageUrl}" class="card-img-top" alt="${service.name}" style="height: 200px; object-fit: cover; background-color: #e9ecef;" onerror="this.onerror=null; this.src='${API_BASE_URL}/storage/defaults/service-default.svg'">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${service.name}</h5>
                        <p class="card-text text-muted flex-grow-1">${service.description || 'No description available'}</p>
                        <div class="mt-auto">
                            <p class="mb-2"><strong class="text-primary">₱${parseFloat(service.price).toFixed(2)}</strong></p>
                            <p class="text-muted small mb-2"><i class="bi bi-clock"></i> ${service.duration_minutes} minutes</p>
                            <button class="btn btn-primary w-100 book-service-btn" data-service-id="${service.id}">
                                <i class="bi bi-calendar-check"></i> Book Now
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        // Add click handler for book button
        serviceCard.find('.book-service-btn').on('click', function(e) {
            e.stopPropagation(); // Prevent card click
            openBookingModal(service);
        });
        
        // Add hover effect
        serviceCard.find('.service-card').on('mouseenter', function() {
            $(this).css('transform', 'translateY(-5px)');
        }).on('mouseleave', function() {
            $(this).css('transform', 'translateY(0)');
        });
        
        grid.append(serviceCard);
    });
}

function loadTherapists() {
    axios.get(`${API_BASE_URL}/api/bookings/available-therapists`)
        .then(function(response) {
            if (response.data.success) {
                const select = $('#therapist_id');
                select.empty();
                select.html('<option value="">Choose a therapist...</option>');
                
                const therapists = response.data.data || [];
                if (therapists.length === 0) {
                    select.html('<option value="">No therapists available</option>');
                    return;
                }
                
                therapists.forEach(therapist => {
                    const option = $('<option></option>')
                        .val(therapist.id)
                        .text(`${therapist.firstname} ${therapist.lastname}`)
                        .data('therapist', therapist);
                    select.append(option);
                });
            }
        })
        .catch(function(error) {
            console.error('Error loading therapists:', error);
            const select = $('#therapist_id');
            select.html('<option value="">Error loading therapists</option>');
        });
}

function convertTo12Hour(time24) {
    // Convert 24-hour format (HH:MM) to 12-hour format (h:MM AM/PM)
    if (!time24 || typeof time24 !== 'string') return time24;
    
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const minute = minutes || '00';
    
    if (isNaN(hour)) return time24;
    
    let hour12 = hour % 12;
    if (hour12 === 0) hour12 = 12;
    
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minute} ${ampm}`;
}

function loadAvailableTimeSlots() {
    const therapistId = $('#therapist_id').val();
    const bookingDate = $('#booking_date').val();

    if (!therapistId || !bookingDate) {
        $('#booking_time').html('<option value="">Select therapist and date first</option>');
        return;
    }

    // Show loading state
    $('#booking_time').html('<option value="">Loading time slots...</option>').prop('disabled', true);

    axios.get(`${API_BASE_URL}/api/bookings/available-slots?therapist_id=${therapistId}&booking_date=${bookingDate}`)
        .then(function(response) {
            const select = $('#booking_time');
            select.prop('disabled', false);
            select.empty();
            
            if (response.data.success) {
                const slots = response.data.data || [];
                if (slots.length === 0) {
                    select.html('<option value="">No time slots available</option>');
                } else {
                    select.html('<option value="">Choose a time...</option>');
                    slots.forEach(slot => {
                        // Handle both old format (string) and new format (object)
                        if (typeof slot === 'string') {
                            const time12 = convertTo12Hour(slot);
                            select.append(`<option value="${slot}">${time12}</option>`);
                        } else {
                            const time = slot.time;
                            const available = slot.available;
                            const time12 = convertTo12Hour(time);
                            if (available) {
                                select.append(`<option value="${time}">${time12}</option>`);
                            } else {
                                // Slot is not available - either approved by someone else or user already booked it
                                select.append(`<option value="${time}" disabled style="color: #999;">${time12} (Not Available)</option>`);
                            }
                        }
                    });
                }
            } else {
                select.html('<option value="">Error loading time slots</option>');
            }
        })
        .catch(function(error) {
            console.error('Error loading time slots:', error);
            const select = $('#booking_time');
            select.prop('disabled', false);
            const message = error.response?.data?.message || 'Error loading time slots';
            select.html(`<option value="">${message}</option>`);
        });
}

function createBooking() {
    // Validate form
    if (!$('#service_id').val()) {
        $('#errorMessage').removeClass('d-none').text('Please select a service');
        return;
    }
    
    if (!$('#therapist_id').val()) {
        $('#errorMessage').removeClass('d-none').text('Please select a therapist');
        return;
    }
    
    if (!$('#booking_date').val()) {
        $('#errorMessage').removeClass('d-none').text('Please select a date');
        return;
    }
    
    // Final validation: ensure date is not today (with fresh date calculation)
    const selectedDate = $('#booking_date').val();
    if (!selectedDate) {
        $('#errorMessage').removeClass('d-none').text('Please select a date');
        return;
    }
    
    // Compare dates strictly in UTC+8
    const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const tomorrowStr = new Date(Date.now() + UTC8_OFFSET_MS + ONE_DAY_MS).toISOString().split('T')[0];
    
    if (selectedDate < tomorrowStr) {
        $('#errorMessage').removeClass('d-none').text('You cannot book for today. Please select a date starting from tomorrow.');
        $('#booking_date').val('');
        const dateInput = document.getElementById('booking_date');
        if (dateInput) {
            dateInput.value = '';
            dateInput.setAttribute('value', '');
        }
        return;
    }
    
    // (selectedDate < tomorrowStr already guarantees the selected date is at least tomorrow in UTC+8)
    
    if (!$('#booking_time').val()) {
        $('#errorMessage').removeClass('d-none').text('Please select a time');
        return;
    }
    
    // Check if selected time is disabled (not available)
    const selectedTime = $('#booking_time').val();
    const selectedOption = $('#booking_time option:selected');
    if (selectedOption.prop('disabled')) {
        $('#errorMessage').removeClass('d-none').text('This time slot is not available. Please select another time.');
        $('#booking_time').val('');
        return;
    }

    // Final check right before API call - ensure date is still valid
    const finalDateCheck = $('#booking_date').val();
    if (finalDateCheck) {
        const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        const tomorrowStr = new Date(Date.now() + UTC8_OFFSET_MS + ONE_DAY_MS).toISOString().split('T')[0];
        
        if (finalDateCheck < tomorrowStr) {
            $('#errorMessage').removeClass('d-none').text('You cannot book for today. Please select a date starting from tomorrow.');
            $('#booking_date').val('');
            const dateInput = document.getElementById('booking_date');
            if (dateInput) {
                dateInput.value = '';
            }
            $('#submitBookingBtn').prop('disabled', false).text('Book Appointment');
            return;
        }
    }

    const data = {
        service_id: $('#service_id').val(),
        therapist_id: $('#therapist_id').val(),
        booking_date: $('#booking_date').val(),
        booking_time: $('#booking_time').val(),
    };

    $('#errorMessage').addClass('d-none').text('');
    $('#submitBookingBtn').prop('disabled', true).text('Booking...');

    axios.post(`${API_BASE_URL}/api/bookings`, data)
        .then(function(response) {
            if (response.data.success) {
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('bookingModal'));
                modal.hide();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: 'Booking created successfully!',
                    timer: 2000,
                    showConfirmButton: true,
                    confirmButtonText: 'View Bookings'
                }).then((result) => {
                    if (result.isConfirmed || result.dismiss === Swal.DismissReason.timer) {
                        window.location.href = 'client-bookings.html';
                    }
                });
            }
        })
        .catch(function(error) {
            const message = error.response?.data?.message || 'Error creating booking';
            $('#errorMessage').removeClass('d-none').text(message);
            $('#submitBookingBtn').prop('disabled', false).text('Book Appointment');
        });
}

// ============================================
// CLIENT BOOKINGS (View Bookings Page)
// ============================================
let clientBookingsCurrentPage = 1;

$(document).ready(function() {
    // Only initialize bookings page if we're on the bookings page
    if ($('#bookingsTableBody').length > 0 || $('#bookingsGridBody').length > 0) {
        // Check if this is client bookings page (not admin or therapist)
        const user = getCurrentUser();
        if (user && user.user_type === 'client') {
            checkClientAuth();
            loadClientBookings();
            
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

function loadClientBookings(page = 1) {
    clientBookingsCurrentPage = page;
    const params = new URLSearchParams({ page: page });
    
    const status = $('#statusFilter').val();
    if (status) params.append('status', status);

    axios.get(`${API_BASE_URL}/api/bookings?${params}`)
        .then(function(response) {
            if (response.data.success) {
                displayClientBookings(response.data.data);
                displayClientBookingsPagination(response.data.data);
            }
        })
        .catch(function(error) {
            console.error('Error loading bookings:', error);
            $('#bookingsTableBody').html('<tr><td colspan="7" class="text-center text-danger">Error loading bookings</td></tr>');
            $('#bookingsGridBody').html('<div class="col-12 text-center text-danger">Error loading bookings</div>');
        });
}

function displayClientBookings(data) {
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
        
        let actionButton = '';
        let mobileActionButton = '';
        if (booking.status === 'pending') {
            actionButton = `
                <button class="btn btn-sm btn-danger" onclick="cancelBooking(${booking.id})">
                    <i class="bi bi-x-circle"></i> Cancel
                </button>
            `;
            mobileActionButton = `
                <button class="btn btn-sm btn-danger w-100" onclick="cancelBooking(${booking.id})">
                    <i class="bi bi-x-circle"></i> Cancel Booking
                </button>
            `;
        } else {
            actionButton = '<span class="text-muted">-</span>';
            mobileActionButton = '<span class="text-muted">No actions available</span>';
        }
        
        // Table row for desktop
        const row = `
            <tr>
                <td>${booking.id}</td>
                <td>${booking.therapist.firstname} ${booking.therapist.lastname}</td>
                <td>${booking.service.name}</td>
                <td>${new Date(booking.booking_date).toLocaleDateString()}</td>
                <td>${booking.booking_time}</td>
                <td><span class="badge bg-${badgeClass}">${booking.status}</span></td>
                <td>${actionButton}</td>
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
                            <small class="text-muted d-block">Therapist</small>
                            <strong>${booking.therapist.firstname} ${booking.therapist.lastname}</strong>
                        </div>
                        <div class="mb-3">
                            <small class="text-muted d-block">Date & Time</small>
                            <strong>${new Date(booking.booking_date).toLocaleDateString()} at ${booking.booking_time}</strong>
                        </div>
                        <div>
                            ${mobileActionButton}
                        </div>
                    </div>
                </div>
            </div>
        `;
        gridBody.append(card);
    });
}

function cancelBooking(bookingId) {
    Swal.fire({
        title: 'Are you sure?',
        text: 'Are you sure you want to cancel this booking?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, cancel it!'
    }).then((result) => {
        if (result.isConfirmed) {
            axios.post(`${API_BASE_URL}/api/bookings/${bookingId}/cancel`)
                .then(function(response) {
                    if (response.data.success) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Cancelled!',
                            text: 'Booking cancelled successfully',
                            timer: 2000,
                            showConfirmButton: false
                        });
                        loadClientBookings(clientBookingsCurrentPage);
                    }
                })
                .catch(function(error) {
                    const message = error.response?.data?.message || 'Error cancelling booking';
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: message
                    });
                });
        }
    });
}

function displayClientBookingsPagination(data) {
    const nav = $('#paginationNav');
    const navMobile = $('#paginationNavMobile');
    nav.empty();
    navMobile.empty();
    if (data.last_page <= 1) return;

    let pagination = '<ul class="pagination">';
    pagination += `<li class="page-item ${data.current_page === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="loadClientBookings(${data.current_page - 1}); return false;">Previous</a>
    </li>`;
    for (let i = 1; i <= data.last_page; i++) {
        pagination += `<li class="page-item ${i === data.current_page ? 'active' : ''}">
            <a class="page-link" href="#" onclick="loadClientBookings(${i}); return false;">${i}</a>
        </li>`;
    }
    pagination += `<li class="page-item ${data.current_page === data.last_page ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="loadClientBookings(${data.current_page + 1}); return false;">Next</a>
    </li>`;
    pagination += '</ul>';
    nav.html(pagination);
    navMobile.html(pagination);
}

// ============================================
// WRAPPER FUNCTIONS FOR COMPATIBILITY
// ============================================
// Wrapper for client bookings page (called from HTML onclick)
function loadBookings(page) {
    const user = getCurrentUser();
    if (user && user.user_type === 'client') {
        loadClientBookings(page || 1);
    }
}
