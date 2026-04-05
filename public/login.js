// login.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const userIdInput = document.getElementById('user_id');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Stop the form from submitting normally
        loginError.textContent = ''; // Clear previous errors

        const user_id = userIdInput.value.trim();
        const password = passwordInput.value.trim();

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id, password })
            });

            const result = await response.json();

            if (response.ok) {
                // Login successful!
                // Check if the user is an admin or a regular user
                if (result.user.is_admin) {
                    // Redirect to the admin dashboard
                    window.location.href = 'admin.html';
                } else {
                    // Redirect to the regular user dashboard
                    window.location.href = 'dashboard.html';
                }
            } else {
                // Show the error message from the server
                loginError.textContent = result.error;
            }
        } catch (err) {
            loginError.textContent = 'An error occurred. Please try again.';
            console.error('Login failed:', err);
        }
    });
});