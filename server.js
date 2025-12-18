const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise'); 
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.NODE_ENV === 'test' ? 0 : 5001;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/menu', (req, res) => {
    res.sendFile(path.join(__dirname, 'menu.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'contact.html'));
});

app.get('/reviews', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root', 
    password: 'Wb0!7ur89', 
    database: 'divodivnoe',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                email VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS dishes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                price DECIMAL(10,2) NOT NULL,
                category VARCHAR(50),
                image_url VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS dish_reviews (
                id INT AUTO_INCREMENT PRIMARY KEY,
                dish_id INT NOT NULL,
                username VARCHAR(50) NOT NULL,
                review TEXT NOT NULL,
                rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_number VARCHAR(20) NOT NULL UNIQUE,
                customer_name VARCHAR(100) NOT NULL,
                customer_phone VARCHAR(20) NOT NULL,
                customer_address TEXT NOT NULL,
                payment_method VARCHAR(20) NOT NULL,
                total_amount DECIMAL(10,2) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                comments TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                dish_id INT NOT NULL,
                dish_name VARCHAR(100) NOT NULL,
                quantity INT NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (dish_id) REFERENCES dishes(id)
            )
        `);
        
        console.log('Таблицы базы данных инициализированы');
    } catch (err) {
        console.error('Ошибка при инициализации базы данных:', err);
    }
}

initializeDatabase();

app.get('/api/dishes-with-reviews', async (req, res) => {
    try {
        const [dishes] = await pool.query('SELECT * FROM dishes ORDER BY id');
        const [reviews] = await pool.query('SELECT * FROM dish_reviews ORDER BY created_at DESC');
        
        const dishesWithReviews = dishes.map(dish => ({
            ...dish,
            reviews: reviews.filter(review => review.dish_id === dish.id)
        }));
        
        res.json(dishesWithReviews);
    } catch (err) {
        console.error('Ошибка при получении блюд с отзывами:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/dishes-with-ratings', async (req, res) => {
    try {
        const [dishes] = await pool.query('SELECT * FROM dishes ORDER BY id');
        
        for (const dish of dishes) {
            const [ratingResult] = await pool.query(`
                SELECT 
                    AVG(rating) as average_rating, 
                    COUNT(*) as review_count 
                FROM dish_reviews 
                WHERE dish_id = ?
            `, [dish.id]);
            
            dish.average_rating = ratingResult[0].average_rating || 0;
            dish.review_count = ratingResult[0].review_count || 0;
        }
        
        res.json(dishes);
    } catch (err) {
        console.error('Ошибка при получении блюд с рейтингами:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/dishes/:id/reviews', async (req, res) => {
    const { username, review, rating } = req.body;
    const dishId = req.params.id;

    if (!username || !review || !rating) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Оценка должна быть от 1 до 5' });
    }

    try {
        await pool.query(
            'INSERT INTO dish_reviews (dish_id, username, review, rating) VALUES (?, ?, ?, ?)',
            [dishId, username, review, rating]
        );
        
        const [ratingResult] = await pool.query(`
            SELECT 
                AVG(rating) as average_rating, 
                COUNT(*) as review_count 
            FROM dish_reviews 
            WHERE dish_id = ?
        `, [dishId]);
        
        res.status(201).json({
            success: true,
            average_rating: parseFloat(ratingResult[0].average_rating) || 0,
            review_count: ratingResult[0].review_count || 0
        });
    } catch (err) {
        console.error('Ошибка при добавлении отзыва:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/orders', async (req, res) => {
    const { customer_name, customer_phone, customer_address, payment_method, comments, items } = req.body;
    
    if (!customer_name || !customer_phone || !customer_address || !payment_method || !items || items.length === 0) {
        return res.status(400).json({ error: 'Неверные данные заказа' });
    }
    
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const total_amount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        const order_number = `ORD-${Date.now()}`;
        
        const [orderResult] = await connection.query(
            `INSERT INTO orders 
            (order_number, customer_name, customer_phone, customer_address, payment_method, total_amount, comments) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [order_number, customer_name, customer_phone, customer_address, payment_method, total_amount, comments]
        );
        
        const orderId = orderResult.insertId;
        
        for (const item of items) {
            await connection.query(
                `INSERT INTO order_items 
                (order_id, dish_id, dish_name, quantity, price) 
                VALUES (?, ?, ?, ?, ?)`,
                [orderId, item.id, item.name, item.quantity, item.price]
            );
        }
        
        await connection.commit();
        
        res.status(201).json({ 
            success: true, 
            order_number,
            order_id: orderId
        });
    } catch (err) {
        await connection.rollback();
        console.error('Ошибка при создании заказа:', err);
        res.status(500).json({ error: 'Ошибка сервера при создании заказа' });
    } finally {
        connection.release();
    }
});

app.get('/api/reviews', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM reviews ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.post('/api/reviews', async (req, res) => {
    const { username, review, rating } = req.body;

    if (!username || !review || !rating) {
        return res.status(400).json({ success: false, message: 'Неверные данные' });
    }

    try {
        await pool.query('INSERT INTO reviews (username, review, rating) VALUES (?, ?, ?)', [username, review, rating]);
        res.status(201).json({ success: true, message: 'Отзыв успешно добавлен' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Пароль должен быть не менее 6 символов' });
    }

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
        if (users.length > 0) {
            return res.status(400).json({ success: false, message: 'Пользователь с таким именем или email уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);
        res.status(201).json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка регистрации' });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);

        if (users.length > 0) {
            const user = users[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                res.json({ success: true, username: user.username });
            } else {
                res.status(401).json({ success: false, message: 'Неверное имя пользователя или пароль' });
            }
        } else {
            res.status(401).json({ success: false, message: 'Неверное имя пользователя или пароль' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Ошибка входа' });
    }
});

const server = app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});

module.exports = { app, server, pool };