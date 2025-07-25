// AAA - Importaciones y Mocks Globales
let mockQuery = jest.fn();
let mockExecute = jest.fn();
let mockRelease = jest.fn();

// Mocks globales para la conexión a la base de datos
jest.mock('../config/mysql', () => ({
  getConnection: jest.fn(() => ({
    query: mockQuery,
    execute: mockExecute,
    release: mockRelease,
  }))
}));

// AAA - Configuración del Servidor de Pruebas
const salasRouter = require('../router/salas'); 
const testServer = require('../utils/testServer');

const request = testServer(salasRouter);

// AAA - Implementaciones de Mocks por Defecto para el Módulo de Salas
const defaultQueryMockImplementation = (sql, params) => {
  // Mock para SELECT * FROM salas WHERE visible = 1 (usado en obtener_Salas y registrar_Sala)
  if (sql.includes('SELECT * FROM salas WHERE visible = 1')) {
    return Promise.resolve([
      [],
      []
    ]);
  }
  // Mock para INSERT INTO salas
  if (sql.includes('INSERT INTO salas')) {
    return Promise.resolve([
      { affectedRows: 1, insertId: 1 }, // Simula una inserción exitosa
      []
    ]);
  }
  // Mock para SELECT * FROM salas WHERE idSala = ? AND visible = 1 (usado en obtener_Sala_One, modificar_Sala, eliminar_Sala)
  if (sql.includes('SELECT * FROM salas WHERE idSala = ? AND visible = 1')) {
    return Promise.resolve([
      [],
      []
    ]);
  }
  // Mock para UPDATE salas SET nombre = ?, descripcion = ? WHERE idSala = ? (usado en modificar_Sala)
  if (sql.includes('UPDATE salas SET nombre = ?, descripcion = ? WHERE idSala = ?')) {
    return Promise.resolve([
      { affectedRows: 1 }, // Simula una actualización exitosa
      []
    ]);
  }
  // Mock para UPDATE salas SET visible = 0 WHERE idSala = ? (usado en eliminar_Sala)
  if (sql.includes('UPDATE salas SET visible = 0 WHERE idSala = ?')) {
    return Promise.resolve([
      { affectedRows: 1 }, // Simula una eliminación lógica exitosa
      []
    ]);
  }
  // Mock para SELECT * FROM salas WHERE idSala = ? (después de update en modificar_Sala)
  if (sql.includes('SELECT * FROM salas WHERE idSala = ?') && !sql.includes('visible = 1')) {
    return Promise.resolve([
      [{ idSala: 1, nombre: 'Sala Modificada', descripcion: 'Descripcion Modificada', visible: 1 }],
      []
    ]);
  }
  return Promise.resolve([[], []]);
};

// AAA - Bloque Principal de Pruebas
describe('Salas Routes', () => {
  // AAA - Configuración antes de cada Prueba
  beforeEach(() => {
    jest.clearAllMocks(); // Limpia todos los mocks

    // Restablece los mocks de DB a sus implementaciones por defecto
    mockQuery.mockImplementation(defaultQueryMockImplementation);
    mockExecute.mockClear();
    mockRelease.mockClear();
  });

  // AAA - Pruebas para POST /salas
  describe('POST /salas', () => {
    const newSala = {
      nombre: 'Sala de Pruebas',
      descripcion: 'Una sala para realizar pruebas unitarias',
    };

    it('debería registrar una sala exitosamente', async () => {
      // AAA - Arrange
      // La implementación por defecto de mockQuery ya maneja el caso de no encontrar salas existentes
      // y simula una inserción exitosa.

      // AAA - Act
      const response = await request.post('/salas').send(newSala);

      // AAA - Assert
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ ok: true, msg: 'Sala creada exitosamente' });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM salas WHERE visible = 1");
      expect(mockQuery).toHaveBeenCalledWith("INSERT INTO salas(nombre, descripcion) VALUES(?, ?);", [newSala.nombre, newSala.descripcion]);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería rechazar si el nombre de la sala ya existe', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([
        [{ idSala: 1, nombre: 'Sala de Pruebas', descripcion: 'Existente', visible: 1 }], // Simula que la sala ya existe
        []
      ]);

      // AAA - Act
      const response = await request.post('/salas').send(newSala);

      // AAA - Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ ok: false, msg: 'El nombre de la sala ya existe' });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM salas WHERE visible = 1");
      expect(mockQuery).not.toHaveBeenCalledWith("INSERT INTO salas(nombre, descripcion) VALUES(?, ?);", expect.any(Array)); // No se debe llamar a la inserción
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería manejar errores de base de datos durante el registro', async () => {
      // AAA - Arrange
      mockQuery.mockRejectedValueOnce(new Error('DB insert error'));

      // AAA - Act
      const response = await request.post('/salas').send(newSala);

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // AAA - Pruebas para GET /salas
  describe('GET /salas', () => {
    it('debería retornar todas las salas visibles', async () => {
      // AAA - Arrange
      const mockSalas = [
        { idSala: 1, nombre: 'Sala A', descripcion: 'Desc A', visible: 1 },
        { idSala: 2, nombre: 'Sala B', descripcion: 'Desc B', visible: 1 },
      ];
      mockQuery.mockResolvedValueOnce([mockSalas, []]);

      // AAA - Act
      const response = await request.get('/salas');

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { idSala: 1, nombre: 'Sala A', descripcion: 'Desc A' },
        { idSala: 2, nombre: 'Sala B', descripcion: 'Desc B' },
      ]);
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM salas WHERE visible = 1");
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería retornar un array vacío si no hay salas', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[], []]); // Simula que no hay salas visibles

      // AAA - Act
      const response = await request.get('/salas');

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM salas WHERE visible = 1");
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería manejar errores de base de datos', async () => {
      // AAA - Arrange
      mockQuery.mockRejectedValueOnce(new Error('DB connection error'));

      // AAA - Act
      const response = await request.get('/salas');

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // AAA - Pruebas para GET /salas/:idSala
  describe('GET /salas/:idSala', () => {
    const salaId = 1;

    it('debería retornar una sala específica si existe y es visible', async () => {
      // AAA - Arrange
      const mockSala = { idSala: salaId, nombre: 'Sala Única', descripcion: 'Una sala para test', visible: 1 };
      mockQuery.mockResolvedValueOnce([[mockSala], []]);

      // AAA - Act
      const response = await request.get(`/salas/${salaId}`);

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ idSala: salaId, nombre: 'Sala Única', descripcion: 'Una sala para test' });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM salas WHERE idSala = ? AND visible = 1", [salaId.toString()]);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería retornar 404 si la sala no es encontrada o no es visible', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[], []]); // No se encuentra la sala

      // AAA - Act
      const response = await request.get(`/salas/${salaId}`);

      // AAA - Assert
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ ok: false, msg: 'Sala no encontrada' });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM salas WHERE idSala = ? AND visible = 1", [salaId.toString()]);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería manejar errores de base de datos', async () => {
      // AAA - Arrange
      mockQuery.mockRejectedValueOnce(new Error('DB error on single sala query'));

      // AAA - Act
      const response = await request.get(`/salas/${salaId}`);

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // AAA - Pruebas para PUT /salas/:idSala
  describe('PUT /salas/:idSala', () => {
    const salaId = 1;
    const updatedSalaData = {
      nombre: 'Sala Actualizada',
      descripcion: 'Descripción de sala actualizada',
    };

    it('debería modificar una sala exitosamente', async () => {
      // AAA - Arrange
      const existingSala = { idSala: salaId, nombre: 'Sala Original', descripcion: 'Desc Original', visible: 1 };
      const updatedSalaInDb = { idSala: salaId, nombre: 'Sala Actualizada', descripcion: 'Descripción de sala actualizada', visible: 1 };

      mockQuery
        .mockResolvedValueOnce([[existingSala], []]) // Simula que la sala existe
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Simula la actualización
        .mockResolvedValueOnce([[updatedSalaInDb], []]); // Simula la obtención de la sala actualizada

      // AAA - Act
      const response = await request.put(`/salas/${salaId}`).send(updatedSalaData);

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        idSala: salaId,
        nombre: updatedSalaData.nombre,
        descripcion: updatedSalaData.descripcion,
      });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM salas WHERE idSala = ? AND visible = 1", [salaId.toString()]);
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE salas SET nombre = ?, descripcion = ? WHERE idSala = ?",
        [updatedSalaData.nombre, updatedSalaData.descripcion, salaId.toString()]
      );
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM salas WHERE idSala = ?", [salaId.toString()]);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería retornar 404 si la sala a modificar no es encontrada o no es visible', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[], []]); // No se encuentra la sala

      // AAA - Act
      const response = await request.put(`/salas/${salaId}`).send(updatedSalaData);

      // AAA - Assert
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ ok: false, msg: 'Sala no encontrada' });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM salas WHERE idSala = ? AND visible = 1", [salaId.toString()]);
      expect(mockQuery).not.toHaveBeenCalledWith("UPDATE salas SET nombre = ?, descripcion = ? WHERE idSala = ?", expect.any(Array));
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería manejar errores de base de datos durante la modificación', async () => {
      // AAA - Arrange
      const existingSala = { idSala: salaId, nombre: 'Sala Original', descripcion: 'Desc Original', visible: 1 };
      mockQuery
        .mockResolvedValueOnce([[existingSala], []]) // Simula que la sala existe
        .mockRejectedValueOnce(new Error('DB update error')); // Simula un error en la actualización

      // AAA - Act
      const response = await request.put(`/salas/${salaId}`).send(updatedSalaData);

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // AAA - Pruebas para DELETE /salas/:idSala
  describe('DELETE /salas/:idSala', () => {
    const salaId = 1;

    it('debería eliminar una sala exitosamente (cambio de visible a 0)', async () => {
      // AAA - Arrange
      const existingSala = { idSala: salaId, nombre: 'Sala a Eliminar', descripcion: 'Desc', visible: 1 };
      mockQuery
        .mockResolvedValueOnce([[existingSala], []]) // Simula que la sala existe
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Simula la actualización a visible = 0

      // AAA - Act
      const response = await request.delete(`/salas/${salaId}`);

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, msg: 'Sala eliminada exitosamente' });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM salas WHERE idSala = ? AND visible = 1", [salaId.toString()]);
      expect(mockQuery).toHaveBeenCalledWith("UPDATE salas SET visible = 0 WHERE idSala = ?", [salaId.toString()]);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería retornar 404 si la sala a eliminar no es encontrada o no es visible', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[], []]); // No se encuentra la sala

      // AAA - Act
      const response = await request.delete(`/salas/${salaId}`);

      // AAA - Assert
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ ok: false, msg: 'Sala no encontrada' });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM salas WHERE idSala = ? AND visible = 1", [salaId.toString()]);
      expect(mockQuery).not.toHaveBeenCalledWith("UPDATE salas SET visible = 0 WHERE idSala = ?", expect.any(Array));
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería manejar errores de base de datos durante la eliminación', async () => {
      // AAA - Arrange
      const existingSala = { idSala: salaId, nombre: 'Sala a Eliminar', descripcion: 'Desc', visible: 1 };
      mockQuery
        .mockResolvedValueOnce([[existingSala], []])
        .mockRejectedValueOnce(new Error('DB delete error'));

      // AAA - Act
      const response = await request.delete(`/salas/${salaId}`);

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });
});
