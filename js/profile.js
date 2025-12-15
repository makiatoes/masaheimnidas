// ============================================
// PROFILE PAGE
// ============================================
$(document).ready(function() {
    checkAuth();
    loadProfile();
    
    $('#profileForm').on('submit', function(e) {
        e.preventDefault();
        updateProfile();
    });

    // Preview image when file is selected
    $('#profile_picture').on('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.match('image.*')) {
                $('#errorMessage').removeClass('d-none').text('Please select an image file');
                $(this).val('');
                return;
            }
            
            // Validate file size (2MB max)
            if (file.size > 2 * 1024 * 1024) {
                $('#errorMessage').removeClass('d-none').text('Image size must be less than 2MB');
                $(this).val('');
                return;
            }
            
            $('#fileName').text('Selected: ' + file.name);
            $('#errorMessage').addClass('d-none');
            
            const $img = $('#profilePicture');
            
            const reader = new FileReader();
            reader.onload = function(e) {
                $img.attr('src', e.target.result).show();
            };
            reader.onerror = function() {
                $('#errorMessage').removeClass('d-none').text('Error reading file');
            };
            reader.readAsDataURL(file);
        }
    });

    // Logout handler will be set up in setupNavbar function using event delegation
});

function checkAuth() {
    const user = getCurrentUser();
    if (!user || !isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Set dashboard link based on user type
    const dashboardLinks = {
        'admin': 'admin-dashboard.html',
        'therapist': 'therapist-dashboard.html',
        'client': 'client-dashboard.html'
    };
    $('#dashboardLink').attr('href', dashboardLinks[user.user_type] || 'index.html');
    
    // Populate navbar based on user type
    setupNavbar(user.user_type);
}

function setupNavbar(userType) {
    const navbarMenu = $('#navbarMenu');
    navbarMenu.empty();
    
    let menuItems = [];
    
    if (userType === 'admin') {
        menuItems = [
            { href: 'admin-dashboard.html', text: 'Dashboard', active: false },
            { href: 'admin-users.html', text: 'Users', active: false },
            { href: 'admin-services.html', text: 'Services', active: false },
            { href: 'admin-bookings.html', text: 'Bookings', active: false },
            { href: 'profile.html', text: 'Profile', active: true },
            { href: '#', text: 'Logout', id: 'logoutLink', active: false }
        ];
    } else if (userType === 'therapist') {
        menuItems = [
            { href: 'therapist-dashboard.html', text: 'Dashboard', active: false },
            { href: 'therapist-bookings.html', text: 'Bookings', active: false },
            { href: 'profile.html', text: 'Profile', active: true },
            { href: '#', text: 'Logout', id: 'logoutLink', active: false }
        ];
    } else if (userType === 'client') {
        menuItems = [
            { href: 'client-dashboard.html', text: 'Dashboard', active: false },
            { href: 'client-booking.html', text: 'Book Appointment', active: false },
            { href: 'client-bookings.html', text: 'My Bookings', active: false },
            { href: 'profile.html', text: 'Profile', active: true },
            { href: '#', text: 'Logout', id: 'logoutLink', active: false }
        ];
    }
    
    menuItems.forEach(item => {
        const li = $('<li></li>').addClass('nav-item');
        const a = $('<a></a>')
            .addClass('nav-link')
            .attr('href', item.href)
            .text(item.text);
        
        if (item.active) {
            a.addClass('active');
        }
        
        if (item.id) {
            a.attr('id', item.id);
        }
        
        li.append(a);
        navbarMenu.append(li);
    });
    
    // Set up logout handler using event delegation
    $(document).off('click', '#logoutLink').on('click', '#logoutLink', function(e) {
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

function loadProfile() {
    axios.get(`${API_BASE_URL}/api/profile`)
        .then(function(response) {
            if (response.data.success) {
                const user = response.data.data;
                $('#firstname').val(user.firstname);
                $('#lastname').val(user.lastname);
                $('#username').val(user.username);
                $('#email').val(user.email);
                $('#phone').val(user.phone);
                
                const $img = $('#profilePicture');
                
                // Use default image if no profile picture is set
                let imagePath = user.profile_picture;
                if (!imagePath || imagePath === 'defaults/profile-default.svg') {
                    imagePath = 'defaults/profile-default.svg';
                }
                
                // Construct image URL - ensure no double slashes
                if (imagePath.startsWith('/')) {
                    imagePath = imagePath.substring(1);
                }
                const imageUrl = `${API_BASE_URL}/storage/${imagePath}?t=${Date.now()}`;
                console.log('Loading profile picture:', imageUrl);
                console.log('Profile picture path from DB:', user.profile_picture);
                
                // Remove previous handlers
                $img.off('error load');
                
                // Set up error handler - fallback to default if image fails
                $img.on('error', function() {
                    console.error('Failed to load profile picture:', imageUrl);
                    // Fallback to default image
                    const defaultUrl = `${API_BASE_URL}/storage/defaults/profile-default.svg?t=${Date.now()}`;
                    $(this).attr('src', defaultUrl);
                });
                
                // Set up load handler
                $img.on('load', function() {
                    console.log('Profile picture loaded successfully');
                    $(this).show();
                });
                
                // Set the src to trigger load
                $img.attr('src', imageUrl).show();
            }
        })
        .catch(function(error) {
            console.error('Error loading profile:', error);
        });
}

function updateProfile() {
    const formData = new FormData();
    formData.append('firstname', $('#firstname').val());
    formData.append('lastname', $('#lastname').val());
    formData.append('username', $('#username').val());
    // Email is not editable - not included in form data
    formData.append('phone', $('#phone').val());
    
    if ($('#password').val()) {
        formData.append('password', $('#password').val());
    }

    // Get file from input
    const profilePictureInput = document.getElementById('profile_picture');
    let profilePicture = null;
    
    if (profilePictureInput && profilePictureInput.files && profilePictureInput.files.length > 0) {
        profilePicture = profilePictureInput.files[0];
    }
    
    console.log('Profile picture input element:', profilePictureInput);
    console.log('Profile picture file:', profilePicture);
    console.log('File input value:', profilePictureInput ? profilePictureInput.value : 'Input not found');
    
    if (profilePicture) {
        console.log('Adding profile picture to FormData:', {
            name: profilePicture.name,
            size: profilePicture.size,
            type: profilePicture.type,
            lastModified: new Date(profilePicture.lastModified)
        });
        
        // Append file to FormData
        formData.append('profile_picture', profilePicture, profilePicture.name);
        
        // Verify file was added
        console.log('FormData entries after adding file:');
        let fileFound = false;
        for (let pair of formData.entries()) {
            if (pair[1] instanceof File) {
                console.log(pair[0] + ': File(' + pair[1].name + ', ' + pair[1].size + ' bytes, ' + pair[1].type + ')');
                if (pair[0] === 'profile_picture') {
                    fileFound = true;
                }
            } else {
                console.log(pair[0] + ': ' + pair[1]);
            }
        }
        
        if (!fileFound) {
            console.error('ERROR: File was not added to FormData!');
            $('#errorMessage').removeClass('d-none').text('Error: File was not added to form. Please try again.');
            return;
        }
    } else {
        console.log('No profile picture file selected - updating profile without image');
    }

    $('#errorMessage').addClass('d-none').text('');
    $('#successMessage').addClass('d-none').text('');
    
    // Disable submit button and show loading
    const $submitBtn = $('button[type="submit"]');
    const originalText = $submitBtn.text();
    $submitBtn.prop('disabled', true).text('Updating...');

    // Get token for authorization
    const token = getToken();
    
    // Laravel doesn't handle file uploads well with PUT, so use POST with method spoofing
    // Add _method field for Laravel to recognize it as PUT
    formData.append('_method', 'PUT');
    
    // Use POST method for file uploads (Laravel will treat it as PUT due to _method field)
    axios({
        method: 'POST',
        url: `${API_BASE_URL}/api/profile`,
        data: formData,
        headers: {
            'Accept': 'application/json',
            'Authorization': token ? 'Bearer ' + token : '',
            // Don't set Content-Type - axios will set it automatically with boundary for FormData
        },
        // Prevent axios from transforming FormData
        transformRequest: function(data, headers) {
            // Remove Content-Type header if it exists, let browser set it with boundary
            delete headers['Content-Type'];
            return data;
        }
    })
        .then(function(response) {
            console.log('Profile update response:', response.data);
            $submitBtn.prop('disabled', false).text(originalText);
            
            if (response.data.success) {
                $('#successMessage').removeClass('d-none').text('Profile updated successfully!');
                $('#errorMessage').addClass('d-none');
                // Update localStorage
                localStorage.setItem('user', JSON.stringify(response.data.data));
                
                // Reload profile picture if updated
                const updatedUser = response.data.data;
                console.log('Updated user data:', updatedUser);
                console.log('Profile picture value:', updatedUser.profile_picture);
                
                const $img = $('#profilePicture');
                
                // Use default image if no profile picture is set
                let imagePath = updatedUser.profile_picture;
                if (!imagePath || imagePath === 'defaults/profile-default.svg') {
                    imagePath = 'defaults/profile-default.svg';
                }
                
                // Construct image URL - ensure no double slashes
                if (imagePath.startsWith('/')) {
                    imagePath = imagePath.substring(1);
                }
                const imageUrl = `${API_BASE_URL}/storage/${imagePath}?t=${Date.now()}`;
                console.log('Loading updated profile picture from:', imageUrl);
                console.log('Profile picture path from server:', updatedUser.profile_picture);
                
                // Remove previous handlers
                $img.off('error load');
                
                // Set up error handler - fallback to default if image fails
                $img.on('error', function() {
                    console.error('Failed to load updated profile picture:', imageUrl);
                    console.error('Profile picture path from server:', updatedUser.profile_picture);
                    // Fallback to default image
                    const defaultUrl = `${API_BASE_URL}/storage/defaults/profile-default.svg?t=${Date.now()}`;
                    $(this).attr('src', defaultUrl);
                });
                
                // Set up load handler
                $img.on('load', function() {
                    console.log('Updated profile picture loaded successfully');
                    $(this).show();
                });
                
                // Set src to trigger load
                $img.attr('src', imageUrl).show();
                // Clear file input
                $('#profile_picture').val('');
                $('#fileName').text('');
            } else {
                const message = response.data.message || 'Error updating profile';
                $('#errorMessage').removeClass('d-none').text(message);
                $('#successMessage').addClass('d-none');
            }
        })
        .catch(function(error) {
            console.error('Profile update error:', error);
            $submitBtn.prop('disabled', false).text(originalText);
            
            let message = 'Error updating profile';
            
            if (error.response) {
                // Server responded with error
                console.error('Error response:', error.response.data);
                if (error.response.data) {
                    if (error.response.data.message) {
                        message = error.response.data.message;
                    } else if (error.response.data.errors) {
                        // Validation errors
                        const errors = error.response.data.errors;
                        message = Object.values(errors).flat().join(', ');
                    }
                }
            } else if (error.request) {
                message = 'No response from server. Please check your connection.';
            } else {
                message = error.message || 'An error occurred';
            }
            
            $('#errorMessage').removeClass('d-none').text(message);
            $('#successMessage').addClass('d-none');
        });
}
