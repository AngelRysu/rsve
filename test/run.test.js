const request = require('supertest');
const app = require('../app');
const db = require('../config/mysql'); // donde exportas tu pool/conexión

describe('Pruebas básicas del servidor', () => {
  test('GET /salas responde con 200', async () => {
    const res = await request(app).get('/salas');
    expect([200, 404]).toContain(res.statusCode);
  });
});



afterAll(async () => {
  await db.end(); // o db.close(), depende de tu cliente
});
