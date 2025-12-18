document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const username = document.getElementById('login').value;
            const password = document.getElementById('password').value;

            fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Успешный вход, показать модальное окно
                    document.getElementById('success-box').style.display = 'block';
                    setTimeout(() => {
                        window.location.href = './../../index.html'; // Перенаправление на index.html
                    }, 2000);
                } else {
                    // Ошибка входа, показать модальное окно
                    document.getElementById('error-box').style.display = 'block';
                }
            });
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', (event) => {
            event.preventDefault();
            console.log('Форма регистрации отправлена');
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('re-pass').value;

            if (password !== confirmPassword) {
                alert('Пароли не совпадают!');
                return;
            }

            fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Успешная регистрация, показать модальное окно
                    document.getElementById('success-box').style.display = 'block';
                    setTimeout(() => {
                        window.location.href = 'login.html'; 
                    });                
                } else {
                        // Ошибка регистрации, показать модальное окно
                        document.getElementById('error-box').style.display = 'block';
                    }
                });
            });
        }
    });
