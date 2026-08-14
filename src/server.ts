import express from 'express';

const app = express();


app.get('/health', (req, res) => {
    res.json({
        status: 'ok'
    });
});

const users = [
    { id: '1', name: 'Ada' },
    { id: '2', name: 'Grace' }
];

app.get('/users', (req, res) => {
    res.json(users);
});

app.get('/users/:id', (req, res, next) => {
    console.log('B');
    res.json({
        id: req.params.id
    });
    next();
});

app.listen(3000, () => {
    console.log(`Сервер запущено, успіх`);
});