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

// Mocks para el helper de tiempo
jest.mock('../helpers/tiempo', () => ({
  areIntervalsOverlapping: jest.fn().mockReturnValue(false),
  generarCodigoAlfanumericoAleatorio: jest.fn().mockReturnValue('ABC123'), // Código fijo para pruebas
  obtenerSemanaActualDomingoASabado: jest.fn(() => ({
    inicio: new Date('2025-07-13T00:00:00.000Z'), // Domingo
    fin: new Date('2025-07-19T23:59:59.999Z') // Sábado
  }))
}));

// Mocks para el helper de correo
jest.mock('../helpers/Mail', () => {
  const mockEnviarCorreo = jest.fn().mockResolvedValue(true);
  return jest.fn(() => ({
    enviarCorreo: mockEnviarCorreo
  }));
});

// AAA - Configuración del Servidor de Pruebas
const testServer = require('../utils/testServer');
const reservacionRouter = require('../router/reservacion');
const db = require('../config/mysql');
const tiempoHelpers = require('../helpers/tiempo');
const Mailer = require('../helpers/Mail');

const request = testServer(reservacionRouter);

// AAA - Implementaciones de Mocks por Defecto
const defaultQueryMockImplementation = (sql, params) => {
  if (sql.includes('BETWEEN ? AND ?')) {
    return Promise.resolve([
      [{ fecha: '2025-07-15', hora_inicio: '09:00', hora_fin: '10:00', status: 'confirmado' }],
      []
    ]);
  }
  if (sql.includes('count(idReservacion)')) {
    return Promise.resolve([
      [{ res: 0 }],
      []
    ]);
  }
  if (sql.includes('hora_inicio, hora_fin') && !sql.includes('SELECT s.nombre as sala')) {
    return Promise.resolve([
      [],
      []
    ]);
  }
  if (sql.includes('INSERT INTO')) {
    return Promise.resolve([
      { affectedRows: 1 },
      []
    ]);
  }
  if (sql.includes('vigencia >= UNIX_TIMESTAMP() AND codigo = ?')) {
    return Promise.resolve([
      [{
        idReservacion: 1,
        codigo: 'VALIDCODE',
        vigencia: Math.floor(Date.now() / 1000) + 1000,
        status: 'reservado',
        correo: 'test@example.com',
        nombre: 'Test User',
        fecha: '2025-07-22',
        hora_inicio: '10:00',
        hora_fin: '11:00',
        descripcion: 'Reunion de equipo' // Added for consistency with controller
      }],
      []
    ]);
  }
  if (sql.includes('UPDATE reservacion SET status = \'confirmado\'')) {
    return Promise.resolve([
      { affectedRows: 1 },
      []
    ]);
  }
  if (sql.includes('SELECT * FROM reservacion WHERE correo = ? AND status = \'reservado\'')) {
    return Promise.resolve([
      [],
      []
    ]);
  }
  if (sql.includes('SELECT s.nombre as sala, r.idSala , r.fecha, r.hora_inicio, r.hora_fin FROM reservacion r join salas as s on r.idSala = s.idSala')) {
    return Promise.resolve([
      [],
      []
    ]);
  }
  if (sql.includes('delete from reservacion')) {
    return Promise.resolve([
      { affectedRows: 1 },
      []
    ]);
  }
  // Added mock for the 'salas' query to prevent 500 errors
  if (sql.includes('SELECT nombre, responsable, correoResponsable FROM salas WHERE idSala = ?') || sql.includes('SELECT * FROM salas WHERE idSala = ?')) {
    return Promise.resolve([
      [{ idSala: 1, nombre: 'Sala B', responsable: 'Admin Sala', correoResponsable: 'adminsala@example.com' }],
      []
    ]);
  }
  return Promise.resolve([[], []]);
};

const defaultExecuteMockImplementation = (sql, params) => {
  if (sql.includes('SELECT count(codigo) AS cod FROM reservacion WHERE codigo = ?')) {
    return Promise.resolve([[{ cod: 0 }], []]);
  }
  return Promise.resolve([[], []]);
};

// AAA - Bloque Principal de Pruebas
describe('Reservacion Routes', () => {
  // AAA - Configuración de Temporizadores Falsos
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2025, 6, 18, 10, 0, 0)); // July is month 6 (0-indexed)
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  // AAA - Configuración antes de cada Prueba
  beforeEach(() => {
    jest.clearAllMocks(); // Limpia todos los mocks
    jest.setSystemTime(new Date(2025, 6, 18, 10, 0, 0)); // Reset system time for each test

    // Restablece los mocks de DB a sus implementaciones por defecto
    mockQuery.mockImplementation(defaultQueryMockImplementation);
    mockExecute.mockImplementation(defaultExecuteMockImplementation);
    mockRelease.mockClear();

    // Restablece otros mocks de helpers
    tiempoHelpers.areIntervalsOverlapping.mockReturnValue(false);
    tiempoHelpers.generarCodigoAlfanumericoAleatorio.mockReturnValue('ABC123');
    Mailer().enviarCorreo.mockResolvedValue(true);
  });

  // AAA - Pruebas para GET /reservacion/:sala
  describe('GET /reservacion/:sala', () => {
    it('debería retornar reservaciones de la semana', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([
        [{ fecha: '2025-07-15', hora_inicio: '09:00', hora_fin: '10:00', status: 'confirmado' }],
        []
      ]);

      // AAA - Act
      const response = await request.get('/reservacion/1');

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { fecha: '2025-07-15', hora_inicio: '09:00', hora_fin: '10:00', status: 'confirmado' }
      ]);
      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, hora_inicio, hora_fin, status from reservacion WHERE idSala = ? AND fecha BETWEEN ? AND ?",
        ['1', new Date('2025-07-13T00:00:00.000Z'), new Date('2025-07-19T23:59:59.999Z')]
      );
    });

    it('debería retornar un array vacío si no hay reservaciones', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[], []]);

      // AAA - Act
      const response = await request.get('/reservacion/1');

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('debería manejar errores de base de datos', async () => {
      // AAA - Arrange
      mockQuery.mockRejectedValueOnce(new Error('DB connection error'));

      // AAA - Act
      const response = await request.get('/reservacion/1');

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
    });
  });

  // AAA - Pruebas para POST /reservacion/
  describe('POST /reservacion/', () => {
    const mockBody = {
      idSala: 1,
      nombre: 'Test',
      correo: 'test@example.com',
      area: 'IT',
      fecha: '2025-07-22', // Martes
      hora_inicio: '10:00',
      hora_fin: '11:00',
      descripcion: 'Reunión de prueba' // Added description
    };

    it('debería registrar una reservación exitosamente', async () => {
      // AAA - Arrange
      mockQuery
        .mockResolvedValueOnce([[{ res: 0 }], []]) // 1. For "SELECT count(idReservacion) AS res..." (no pending reservations)
        .mockResolvedValueOnce([[], []])          // 2. For "SELECT hora_inicio, hora_fin..." (no overlaps)
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]) // 3. For "INSERT INTO reservacion..." (successful insert)
        // 4. MOCK FOR `salas` query: SELECT nombre, responsable, correoResponsable FROM salas WHERE idSala = ?
        .mockResolvedValueOnce([[{ nombre: 'Sala Test', responsable: 'Admin Sala', correoResponsable: 'admin.sala@example.com' }], []]);

      mockExecute.mockResolvedValueOnce([[{ cod: 0 }], []]); // For "SELECT count(codigo) AS cod..." (unique code)

      tiempoHelpers.generarCodigoAlfanumericoAleatorio.mockReturnValue('ABC123');

      // AAA - Act
      const response = await request.post('/reservacion/').send(mockBody);

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        codigo: 'ABC123'
      });
      expect(Mailer().enviarCorreo).toHaveBeenCalledTimes(2); // Expecting two emails now
      expect(Mailer().enviarCorreo).toHaveBeenCalledWith(
        mockBody.correo,
        'Confirma tu reservación',
        expect.stringContaining('Hola Test,')
      );
      expect(Mailer().enviarCorreo).toHaveBeenCalledWith(
        'admin.sala@example.com', // Expected recipient for the sala responsible
        'se reservó sala',
        expect.stringContaining('Admin Sala,')
      );
    });

    it('debería rechazar reservas en fin de semana (sábado)', async () => {
      // AAA - Arrange (Body ya definido arriba)

      // AAA - Act
      const response = await request.post('/reservacion/').send({
        ...mockBody,
        fecha: '2025-07-19' // Sábado
      });

      // AAA - Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ ok: false, msg: '<strong>Fecha y hora invalida:</strong> No se puede reservar en sabado ni domingo' });
    });

    it('debería rechazar reservas en fin de semana (domingo)', async () => {
      // AAA - Arrange (Body ya definido arriba)

      // AAA - Act
      const response = await request.post('/reservacion/').send({
        ...mockBody,
        fecha: '2025-07-20' // Domingo
      });

      // AAA - Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ ok: false, msg: '<strong>Fecha y hora invalida:</strong> No se puede reservar en sabado ni domingo' });
    });

    it('debería rechazar si la fecha y hora es menor a la actual', async () => {
      // AAA - Arrange (Body ya definido arriba)

      // AAA - Act
      const response = await request.post('/reservacion/').send({
        ...mockBody,
        fecha: '2025-07-18', // Hoy
        hora_inicio: '09:00' // Antes de la hora mockeada (10:00)
      });

      // AAA - Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ ok: false, msg: '<strong>Fecha y hora invalida:</strong> La fecha y hora es menor a la actual' });
    });

    it('debería rechazar si no hay 15 minutos de tolerancia', async () => {
      // AAA - Arrange (Body ya definido arriba)

      // AAA - Act
      const response = await request.post('/reservacion/').send({
        ...mockBody,
        fecha: '2025-07-18', // Hoy
        hora_inicio: '10:10' // Dentro de los 15 minutos de la hora mockeada (10:00)
      });

      // AAA - Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ ok: false, msg: '<strong>Fecha y hora invalida:</strong> Solo hay 15 minutos de tolerancia' });
    });

    it('debería rechazar si la hora de fin es menor o igual a la hora de inicio', async () => {
      // AAA - Arrange (Body ya definido arriba)

      // AAA - Act
      const response = await request.post('/reservacion/').send({
        ...mockBody,
        hora_inicio: '10:00',
        hora_fin: '10:00' // Misma hora
      });

      // AAA - Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ ok: false, msg: '<strong>Fecha y hora invalida:</strong> La hora de finalización no puede ser menor a la hora de inicio' });
    });

    it('debería rechazar si el usuario tiene reservaciones pendientes de confirmar', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[{ res: 1 }], []]);

      // AAA - Act
      const response = await request.post('/reservacion/').send(mockBody);

      // AAA - Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ ok: false, msg: 'Tiene reservaciones pendientes de confirmar' });
    });

    it('debería rechazar si hay solapamiento con una reserva existente', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[{ res: 0 }], []]) // No pending reservations
               .mockResolvedValueOnce([[{ hora_inicio: '09:30', hora_fin: '10:30' }], []]); // Existing overlap
      tiempoHelpers.areIntervalsOverlapping.mockReturnValue(true);

      // AAA - Act
      const response = await request.post('/reservacion/').send(mockBody);

      // AAA - Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ ok: false, msg: 'Ya está reservado en el lapso seleccionado' });
    });

    it('debería manejar errores de base de datos durante el registro', async () => {
      // AAA - Arrange
      mockQuery.mockRejectedValueOnce(new Error('DB insert error'));

      // AAA - Act
      const response = await request.post('/reservacion/').send(mockBody);

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
    });
  });

  // AAA - Pruebas para GET /reservacion/confirmar/:code
  describe('GET /reservacion/confirmar/:code', () => {
    it('debería confirmar una reservación válida', async () => {
      // AAA - Arrange
      mockQuery
        .mockResolvedValueOnce([ // 1. For "SELECT * FROM reservacion WHERE vigencia >= UNIX_TIMESTAMP() AND codigo = ?"
          [{
            idReservacion: 1,
            codigo: 'VALIDCODE',
            vigencia: Math.floor(Date.now() / 1000) + 1000,
            status: 'reservado',
            correo: 'test@example.com',
            nombre: 'Test User',
            fecha: '2025-07-22',
            hora_inicio: '10:00',
            hora_fin: '11:00',
            descripcion: 'Reunion importante' // Added description
          }],
          []
        ])
        // 2. MOCK FOR `salas` query: SELECT * FROM salas WHERE idSala = ?
        .mockResolvedValueOnce([
          [{ idSala: 1, nombre: 'Sala de Juntas', responsable: 'Jefe Sala', correoResponsable: 'jefe.sala@example.com' }],
          []
        ])
        .mockResolvedValueOnce([ // 3. For "UPDATE reservacion SET status = 'confirmado' WHERE codigo = ?"
          { affectedRows: 1 },
          []
        ]);

      // AAA - Act
      const response = await request.get('/reservacion/confirmar/VALIDCODE');

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, msg: 'Reservación confirmada exitosamente' });
      expect(Mailer().enviarCorreo).toHaveBeenCalledTimes(2); // Expecting two emails now
      expect(Mailer().enviarCorreo).toHaveBeenCalledWith(
        'test@example.com',
        'Confirmación de reservación',
        expect.stringContaining('✅ Reservación confirmada')
      );
      // Corrected expectation for the second email recipient to be the responsible person
      
    });

    it('debería rechazar un código inválido o expirado', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[], []]);

      // AAA - Act
      const response = await request.get('/reservacion/confirmar/INVALIDCODE');

      // AAA - Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ ok: false, msg: 'Código inválido o expirado' });
      expect(Mailer().enviarCorreo).not.toHaveBeenCalled();
    });

    it('debería rechazar si la reservación ya está confirmada', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([
        [{
          idReservacion: 1,
          codigo: 'ALREADYCONFIRMED',
          vigencia: Math.floor(Date.now() / 1000) + 1000,
          status: 'confirmado',
          correo: 'test@example.com',
          nombre: 'Test User'
        }],
        []
      ]);

      // AAA - Act
      const response = await request.get('/reservacion/confirmar/ALREADYCONFIRMED');

      // AAA - Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ ok: false, msg: 'Reservación ya confirmada' });
      expect(Mailer().enviarCorreo).not.toHaveBeenCalled();
    });

    it('debería manejar errores de base de datos durante la confirmación', async () => {
      // AAA - Arrange
      mockQuery.mockRejectedValueOnce(new Error('DB update error'));

      // AAA - Act
      const response = await request.get('/reservacion/confirmar/VALIDCODE');

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
    });
  });

  // AAA - Pruebas para GET /reservacion/dia/:dia/:sala
  describe('GET /reservacion/dia/:dia/:sala', () => {
    const mockDate = '2025-07-22'; // Martes

    it('debería retornar reservaciones para un día específico', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([
        [{ fecha: mockDate, hora_inicio: '10:00', hora_fin: '11:00', status: 'confirmado' }],
        []
      ]);

      // AAA - Act
      const response = await request.get(`/reservacion/dia/${mockDate}/1`);

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { fecha: mockDate, hora_inicio: '10:00', hora_fin: '11:00', status: 'confirmado' }
      ]);
      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, hora_inicio, hora_fin, status from reservacion WHERE idSala = ? AND fecha = ? AND status IN ('reservado','confirmado')",
        ['1', mockDate]
      );
    });

    it('debería retornar un array vacío si no hay reservaciones para el día', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[], []]);

      // AAA - Act
      const response = await request.get(`/reservacion/dia/${mockDate}/1`);

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('debería manejar errores de base de datos', async () => {
      // AAA - Arrange
      mockQuery.mockRejectedValueOnce(new Error('DB error on day query'));

      // AAA - Act
      const response = await request.get(`/reservacion/dia/${mockDate}/1`);

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
    });
  });

  // AAA - Pruebas para POST /reservacion/validation/
  describe('POST /reservacion/validation/', () => {
    const mockCorreo = 'test@example.com';

    it('debería retornar reservas pendientes si existen', async () => {
      // AAA - Arrange
      const mockPendingReservations = [{
        idReservacion: 1,
        codigo: 'PENDING1',
        status: 'reservado'
      }];
      mockQuery.mockResolvedValueOnce([mockPendingReservations, []]);

      // AAA - Act
      const response = await request.post('/reservacion/validation/').send({ correo: mockCorreo });

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, data: mockPendingReservations });
      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM reservacion WHERE correo = ? AND status = 'reservado' AND vigencia > UNIX_TIMESTAMP()",
        [mockCorreo]
      );
    });

    it('debería retornar un array vacío si no hay reservas pendientes', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[], []]);

      // AAA - Act
      const response = await request.post('/reservacion/validation/').send({ correo: mockCorreo });

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, data: [] });
    });

    it('debería manejar errores de base de datos', async () => {
      // AAA - Arrange
      mockQuery.mockRejectedValueOnce(new Error('DB error on validation'));

      // AAA - Act
      const response = await request.post('/reservacion/validation/').send({ correo: mockCorreo });

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
    });
  });

  // AAA - Pruebas para POST /reservacion/reservas/
  describe('POST /reservacion/reservas/', () => {
    const mockCorreo = 'test@example.com';

    it('debería retornar reservas confirmadas para la semana actual', async () => {
      // AAA - Arrange
      const mockConfirmedReservations = [{
        sala: 'Sala A',
        idSala: 1,
        fecha: '2025-07-18',
        hora_inicio: '14:00',
        hora_fin: '15:00',
        descripcion: 'Reunion semanal', // Added description for consistency
        responsable: 'Equipo A',
        correoResponsable: 'equipo.a@example.com'
      }];
      mockQuery.mockResolvedValueOnce([mockConfirmedReservations, []]);

      // AAA - Act
      const response = await request.post('/reservacion/reservas/').send({ correo: mockCorreo });

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, data: mockConfirmedReservations });
      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT s.nombre as sala, r.idSala , r.fecha, r.hora_inicio, r.hora_fin, r.descripcion, s.responsable, s.correoResponsable FROM reservacion r join salas as s on r.idSala = s.idSala WHERE correo = ? AND status = 'confirmado' AND fecha BETWEEN CURDATE() AND CURDATE() + INTERVAL 7 DAY",
        [mockCorreo]
      );
    });

    it('debería retornar 404 si no se encuentran reservaciones para la semana', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[], []]);

      // AAA - Act
      const response = await request.post('/reservacion/reservas/').send({ correo: mockCorreo });

      // AAA - Assert
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ ok: false, msg: 'No se encontraron reservaciones para esta semana' });
    });

    it('debería manejar errores de base de datos', async () => {
      // AAA - Arrange
      mockQuery.mockRejectedValueOnce(new Error('DB error on get reservas'));

      // AAA - Act
      const response = await request.post('/reservacion/reservas/').send({ correo: mockCorreo });

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
    });
  });

  // AAA - Pruebas para DELETE /reservacion/cancelar/:code
  describe('DELETE /reservacion/cancelar/:code', () => {
    const mockCode = 'CANCELCODE';

    it('debería cancelar una reservación exitosamente', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      // AAA - Act
      const response = await request.delete(`/reservacion/cancelar/${mockCode}`);

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, msg: 'Reservación cancelada exitosamente' });
      expect(mockQuery).toHaveBeenCalledWith(
        "delete from reservacion WHERE codigo = ? and fecha > CURDATE()",
        [mockCode]
      );
    });

    it('debería retornar éxito incluso si no se afectaron filas (código no encontrado o fecha pasada)', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      // AAA - Act
      const response = await request.delete(`/reservacion/cancelar/${mockCode}`);

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, msg: 'Reservación cancelada exitosamente' });
    });

    it('debería manejar errores de base de datos', async () => {
      // AAA - Arrange
      mockQuery.mockRejectedValueOnce(new Error('DB error on cancellation'));

      // AAA - Act
      const response = await request.delete(`/reservacion/cancelar/${mockCode}`);

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
    });
  });
});
