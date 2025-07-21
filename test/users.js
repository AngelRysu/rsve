// AAA - Importaciones y Mocks Globales
let mockQuery = jest.fn();
let mockExecute = jest.fn();
let mockRelease = jest.fn();

// Mocks globales mejorados para la conexión a la base de datos
jest.mock('../config/mysql', () => ({
  getConnection: jest.fn(() => ({
    query: mockQuery,
    execute: mockExecute,
    release: mockRelease,
  }))
}));

// AAA - Configuración del Servidor de Pruebas
const testServer = require('../utils/testServer');
const userRouter = require('../router/users');
const db = require('../config/mysql');

const request = testServer(userRouter);

const defaultQueryMockImplementation = (sql, params) => {

  if (sql.includes('SELECT')) {
    return [[{ idUser: 1, mail: 'test@unitary.com', pass: 'Salaenalgunlugar' , name: 'Angel', area: 'Sistemas' , type: 'usuario', status: 'Activo' }]];
  } else if (sql.includes('INSERT')) {
    return [{ insertId: 1 }];
  } else if (sql.includes('UPDATE')) {
    return [{ affectedRows: 1 }];
  } else if (sql.includes('DELETE')) {
    return [{ affectedRows: 1 }];
  }
  throw new Error(`Unhandled SQL query: ${sql}`);
}
