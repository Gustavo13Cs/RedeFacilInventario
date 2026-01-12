const { db } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'SEGREDO_SUPER_SECRETO_REDE_FACIL'; 

exports.login = async (email, password) => {
    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    const user = users[0];
    if (!user) throw new Error('Usuário não encontrado.');

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw new Error('Senha incorreta.');

    const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '8h' });
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
};


exports.getAllUsers = async () => {
    const [rows] = await db.execute('SELECT id, name, email, role, created_at FROM users');
    return rows;
};

exports.createUser = async ({ name, email, password, role }) => {
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) throw new Error('E-mail já cadastrado.');

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    await db.execute(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [name, email, hash, role || 'admin']
    );
    return { message: 'Usuário criado com sucesso' };
};

exports.deleteUser = async (id) => {
    await db.execute('DELETE FROM users WHERE id = ?', [id]);
    return { message: 'Usuário removido.' };
};