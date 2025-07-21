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

// Mock para bcryptjs
jest.mock('bcryptjs', () => ({
  hashSync: jest.fn((pass, salt) => `hashed_${pass}_${salt}`), // Simula un hash
  compareSync: jest.fn((pass, hashedPass) => hashedPass === `hashed_${pass}_10`), // Simula la comparación
}));

const bycrypt = require('bcryptjs'); // Importa el mock de bcryptjs

// AAA - Configuración del Servidor de Pruebas
const usersRouter = require('../router/users');
const testServer = require('../utils/testServer');
const request = testServer(usersRouter);

// AAA - Implementaciones de Mocks por Defecto para el Módulo de Usuarios
const defaultQueryMockImplementation = (sql, params) => {
  // Mock para SELECT * FROM usuarios WHERE status = 'Activo' (usado en registrar_usuario, obtener_Usuarios)
  if (sql.includes("SELECT * FROM usuarios WHERE status = 'Activo'") && !sql.includes("mail = ?")) {
    return Promise.resolve([
      [], // Por defecto, no hay usuarios activos para registrar_usuario o obtener_Usuarios
      []
    ]);
  }
  // Mock para INSERT INTO usuarios
  if (sql.includes('INSERT INTO usuarios')) {
    return Promise.resolve([
      { affectedRows: 1, insertId: 1 }, // Simula una inserción exitosa
      []
    ]);
  }
  // Mock para SELECT * FROM usuarios WHERE idUser = ? AND status = 'Activo' (obtener_Usuario_One)
  if (sql.includes("SELECT * FROM usuarios WHERE idUser = ? AND status = 'Activo'")) {
    return Promise.resolve([
      [], // Por defecto, usuario no encontrado
      []
    ]);
  }
  // Mock para SELECT * FROM usuarios WHERE iduser = ? AND status = 'Activo' AND type != 'admin' (modificar_Usuario, eliminar_Usuario)
  if (sql.includes("SELECT * FROM usuarios WHERE iduser = ? AND status = 'Activo' AND type != 'admin'")) {
    return Promise.resolve([
      [], // Por defecto, usuario no encontrado o es admin
      []
    ]);
  }
  // Mock para UPDATE usuarios SET mail = ?, pass = ?, name = ?, area = ? where iduser = ? (modificar_Usuario)
  if (sql.includes("UPDATE usuarios SET mail = ?, pass = ?, name = ?, area = ? where iduser = ?")) {
    return Promise.resolve([
      { affectedRows: 1 }, // Simula una actualización exitosa
      []
    ]);
  }
  // Mock para SELECT * FROM usuarios WHERE iduser = ? AND type != 'admin' (después de update en modificar_Usuario)
  if (sql.includes("SELECT * FROM usuarios WHERE iduser = ? AND type != 'admin'")) {
    return Promise.resolve([
      [{ idUser: 1, mail: 'updated@example.com', pass: 'hashed_newpass_10', name: 'Updated User', area: 'IT', status: 'Activo', type: 'usuario' }],
      []
    ]);
  }
  // Mock para SELECT * FROM usuarios WHERE mail = ? AND status = 'Activo' (Logg)
  if (sql.includes("SELECT * FROM usuarios WHERE mail = ? AND status = 'Activo'")) {
    return Promise.resolve([
      [], // Por defecto, usuario de login no encontrado
      []
    ]);
  }
  // Mock para UPDATE usuarios SET status = 'Inactivo' WHERE idUser = ? (eliminar_Usuario)
  if (sql.includes("UPDATE usuarios SET status = 'Inactivo' WHERE idUser = ?")) {
    return Promise.resolve([
      { affectedRows: 1 }, // Simula una eliminación lógica exitosa
      []
    ]);
  }
  return Promise.resolve([[], []]);
};

// AAA - Bloque Principal de Pruebas
describe('Users Routes', () => {
  // AAA - Configuración antes de cada Prueba
  beforeEach(() => {
    jest.clearAllMocks(); // Limpia todos los mocks

    // Restablece los mocks de DB a sus implementaciones por defecto
    mockQuery.mockImplementation(defaultQueryMockImplementation);
    mockExecute.mockClear();
    mockRelease.mockClear();

    // Restablece los mocks de bcryptjs
    bycrypt.hashSync.mockClear();
    bycrypt.compareSync.mockClear();
    bycrypt.hashSync.mockImplementation((pass, salt) => `hashed_${pass}_${salt}`);
    bycrypt.compareSync.mockImplementation((pass, hashedPass) => hashedPass === `hashed_${pass}_10`);
  });

  // AAA - Pruebas para POST /usuarios (registrar_usuario)
  describe('POST /usuarios', () => {
    const newUser = {
      mail: 'test@example.com',
      pass: 'password123',
      name: 'Test User',
      area: 'IT'
    };

    it('debería registrar un usuario exitosamente', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[], []]) // No hay usuarios existentes con ese email
               .mockResolvedValueOnce([{ affectedRows: 1, insertId: 1 }, []]); // Inserción exitosa

      // AAA - Act
      const response = await request.post('/usuarios').send(newUser);

      // AAA - Assert
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ msg: 'Usuario creado exitosamente' });
      expect(bycrypt.hashSync).toHaveBeenCalledWith(newUser.pass, 10);
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE status = 'Activo'");
      expect(mockQuery).toHaveBeenCalledWith(
        "INSERT INTO usuarios(mail, pass, name, area) VALUES(?, ?, ?, ?);",
        [newUser.mail, `hashed_${newUser.pass}_10`, newUser.name, newUser.area]
      );
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería rechazar si el usuario (email) ya existe', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([
        [{ mail: newUser.mail, status: 'Activo' }], // Simula que el usuario ya existe
        []
      ]);

      // AAA - Act
      const response = await request.post('/usuarios').send(newUser);

      // AAA - Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ ok: false, msg: 'el usuario ya existe' });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE status = 'Activo'");
      expect(mockQuery).not.toHaveBeenCalledWith("INSERT INTO usuarios(mail, pass, name, area) VALUES(?, ?, ?, ?);", expect.any(Array));
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería manejar errores de base de datos durante el registro', async () => {
      // AAA - Arrange
      mockQuery.mockRejectedValueOnce(new Error('DB insert error'));

      // AAA - Act
      const response = await request.post('/usuarios').send(newUser);

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // AAA - Pruebas para GET /usuarios (obtener_Usuarios)
  describe('GET /usuarios', () => {
    it('debería retornar todos los usuarios activos', async () => {
      // AAA - Arrange
      const mockUsers = [
        { idUser: 1, mail: 'user1@test.com', name: 'User One', area: 'Dev', status: 'Activo', pass: 'hashed_pass1' },
        { idUser: 2, mail: 'user2@test.com', name: 'User Two', area: 'QA', status: 'Activo', pass: 'hashed_pass2' },
      ];
      mockQuery.mockResolvedValueOnce([mockUsers, []]);

      // AAA - Act
      const response = await request.get('/usuarios');

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { idUser: 1, mail: 'user1@test.com', name: 'User One', area: 'Dev', status: 'Activo' },
        { idUser: 2, mail: 'user2@test.com', name: 'User Two', area: 'QA', status: 'Activo' },
      ]);
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE status = 'Activo'");
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería retornar un array vacío si no hay usuarios activos', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[], []]);

      // AAA - Act
      const response = await request.get('/usuarios');

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE status = 'Activo'");
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería manejar errores de base de datos', async () => {
      // AAA - Arrange
      mockQuery.mockRejectedValueOnce(new Error('DB connection error'));

      // AAA - Act
      const response = await request.get('/usuarios');

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // AAA - Pruebas para GET /usuarios/:idUser (obtener_Usuario_One)
  describe('GET /usuarios/:idUser', () => {
    const userId = 1;

    it('debería retornar un usuario específico si existe y está activo', async () => {
      // AAA - Arrange
      const mockUser = { idUser: userId, mail: 'single@test.com', name: 'Single User', area: 'HR', status: 'Activo', pass: 'hashed_pass' };
      mockQuery.mockResolvedValueOnce([[mockUser], []]);

      // AAA - Act
      const response = await request.get(`/usuarios/${userId}`);

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ idUser: userId, mail: 'single@test.com', name: 'Single User', area: 'HR', status: 'Activo' });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE idUser = ? AND status = 'Activo'", [userId.toString()]);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería retornar 404 si el usuario no es encontrado o está inactivo', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[], []]); // Usuario no encontrado

      // AAA - Act
      const response = await request.get(`/usuarios/${userId}`);

      // AAA - Assert
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ ok: false, msg: 'Usuario no encontrado' }); 
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE idUser = ? AND status = 'Activo'", [userId.toString()]);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería manejar errores de base de datos', async () => {
      // AAA - Arrange
      mockQuery.mockRejectedValueOnce(new Error('DB error on single user query'));

      // AAA - Act
      const response = await request.get(`/usuarios/${userId}`);

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // AAA - Pruebas para PUT /usuarios/:idUser (modificar_Usuario)
  describe('PUT /usuarios/:idUser', () => {
    const userId = 1;
    const updatedUserData = {
      mail: 'updated@example.com',
      name: 'Updated User',
      area: 'IT'
    };
    const updatedUserDataWithPass = {
      mail: 'updated@example.com',
      pass: 'newpass123',
      name: 'Updated User',
      area: 'IT'
    };

    it('debería modificar un usuario exitosamente sin cambiar la contraseña', async () => {
      // AAA - Arrange
      const existingUser = { idUser: userId, mail: 'old@example.com', pass: 'old_hashed_pass', name: 'Old User', area: 'Old', status: 'Activo', type: 'usuario' };
      const updatedUserInDb = { idUser: userId, mail: 'updated@example.com', pass: 'old_hashed_pass', name: 'Updated User', area: 'IT', status: 'Activo', type: 'usuario' };

      mockQuery
        .mockResolvedValueOnce([[existingUser], []]) // Encuentra el usuario existente
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Simula la actualización
        .mockResolvedValueOnce([[updatedUserInDb], []]); // Obtiene el usuario actualizado

      // AAA - Act
      const response = await request.put(`/usuarios/${userId}`).send(updatedUserData);

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        idUser: userId,
        mail: updatedUserData.mail,
        name: updatedUserData.name,
        area: updatedUserData.area,
        status: 'Activo'
      });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE iduser = ? AND status = 'Activo' AND type != 'admin'", [userId.toString()]);
      expect(bycrypt.hashSync).not.toHaveBeenCalled(); // No debería hashearse la contraseña si no se cambia
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE usuarios SET mail = ?, pass = ?, name = ?, area = ? where iduser = ?",
        [updatedUserData.mail, existingUser.pass, updatedUserData.name, updatedUserData.area, userId.toString()]
      );
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE iduser = ? AND type != 'admin'", [userId.toString()]);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería modificar un usuario exitosamente cambiando la contraseña', async () => {
      // AAA - Arrange
      const existingUser = { idUser: userId, mail: 'old@example.com', pass: 'old_hashed_pass', name: 'Old User', area: 'Old', status: 'Activo', type: 'usuario' };
      const updatedUserInDb = { idUser: userId, mail: 'updated@example.com', pass: `hashed_${updatedUserDataWithPass.pass}_10`, name: 'Updated User', area: 'IT', status: 'Activo', type: 'usuario' };

      mockQuery
        .mockResolvedValueOnce([[existingUser], []]) // Encuentra el usuario existente
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Simula la actualización
        .mockResolvedValueOnce([[updatedUserInDb], []]); // Obtiene el usuario actualizado

      // AAA - Act
      const response = await request.put(`/usuarios/${userId}`).send(updatedUserDataWithPass);

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        idUser: userId,
        mail: updatedUserDataWithPass.mail,
        name: updatedUserDataWithPass.name,
        area: updatedUserDataWithPass.area,
        status: 'Activo'
      });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE iduser = ? AND status = 'Activo' AND type != 'admin'", [userId.toString()]);
      expect(bycrypt.hashSync).toHaveBeenCalledWith(updatedUserDataWithPass.pass, 10); // La nueva contraseña debería hashearse
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE usuarios SET mail = ?, pass = ?, name = ?, area = ? where iduser = ?",
        [updatedUserDataWithPass.mail, `hashed_${updatedUserDataWithPass.pass}_10`, updatedUserDataWithPass.name, updatedUserDataWithPass.area, userId.toString()]
      );
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE iduser = ? AND type != 'admin'", [userId.toString()]);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería retornar 404 si el usuario a modificar no es encontrado, está inactivo o es admin', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[], []]); // Usuario no encontrado

      // AAA - Act
      const response = await request.put(`/usuarios/${userId}`).send(updatedUserData);

      // AAA - Assert
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ ok: false, msg: 'Usuario no encontrado' });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE iduser = ? AND status = 'Activo' AND type != 'admin'", [userId.toString()]);
      expect(bycrypt.hashSync).not.toHaveBeenCalled();
      expect(mockQuery).not.toHaveBeenCalledWith("UPDATE usuarios SET mail = ?, pass = ?, name = ?, area = ? where iduser = ?", expect.any(Array));
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería manejar errores de base de datos durante la modificación', async () => {
      // AAA - Arrange
      const existingUser = { idUser: userId, mail: 'old@example.com', pass: 'old_hashed_pass', name: 'Old User', area: 'Old', status: 'Activo', type: 'usuario' };
      mockQuery
        .mockResolvedValueOnce([[existingUser], []]) // Encuentra el usuario existente
        .mockRejectedValueOnce(new Error('DB update error')); // Simula un error en la actualización

      // AAA - Act
      const response = await request.put(`/usuarios/${userId}`).send(updatedUserData);

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // AAA - Pruebas para POST /usuarios/logg (Logg)
  describe('POST /usuarios/logg', () => {
    const loginData = {
      mail: 'login@example.com',
      pass: 'correctpassword'
    };
    const adminLoginData = {
      mail: 'admin@example.com',
      pass: 'adminpass'
    };

    it('debería permitir el login de un usuario normal con credenciales correctas', async () => {
      // AAA - Arrange
      const mockUser = { idUser: 1, mail: loginData.mail, pass: `hashed_${loginData.pass}_10`, name: 'Login User', area: 'Sales', status: 'Activo', type: 'usuario' };
      mockQuery.mockResolvedValueOnce([[mockUser], []]);
      bycrypt.compareSync.mockReturnValue(true); // Simula contraseña correcta

      // AAA - Act
      const response = await request.post('/usuarios/logg').send(loginData);

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        idUser: 1,
        mail: loginData.mail,
        name: 'Login User',
        area: 'Sales',
        status: 'Activo',
      });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE mail = ? AND status = 'Activo'", [loginData.mail]);
      expect(bycrypt.compareSync).toHaveBeenCalledWith(loginData.pass, mockUser.pass);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería permitir el login de un usuario admin con credenciales correctas', async () => {
      // AAA - Arrange
      const mockAdminUser = { idUser: 2, mail: adminLoginData.mail, pass: `hashed_${adminLoginData.pass}_10`, name: 'Admin User', area: 'Management', status: 'Activo', type: 'admin' };
      mockQuery.mockResolvedValueOnce([[mockAdminUser], []]);
      bycrypt.compareSync.mockReturnValue(true); // Simula contraseña correcta

      // AAA - Act
      const response = await request.post('/usuarios/logg').send(adminLoginData);

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        idUser: 2,
        mail: adminLoginData.mail,
        name: 'Admin User',
        area: 'Management',
        status: 'Activo',
        type: 'admin'
      });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE mail = ? AND status = 'Activo'", [adminLoginData.mail]);
      expect(bycrypt.compareSync).toHaveBeenCalledWith(adminLoginData.pass, mockAdminUser.pass);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería rechazar el login si el usuario no es encontrado o está inactivo', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[], []]); // Usuario no encontrado

      // AAA - Act
      const response = await request.post('/usuarios/logg').send(loginData);

      // AAA - Assert
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ ok: false, msg: 'Usuario no encontrado o inactivo' });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE mail = ? AND status = 'Activo'", [loginData.mail]);
      expect(bycrypt.compareSync).not.toHaveBeenCalled(); // No debería intentar comparar la contraseña
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería rechazar el login si la contraseña es incorrecta', async () => {
      // AAA - Arrange
      const mockUser = { idUser: 1, mail: loginData.mail, pass: `hashed_wrongpassword_10`, name: 'Login User', area: 'Sales', status: 'Activo', type: 'usuario' };
      mockQuery.mockResolvedValueOnce([[mockUser], []]);
      bycrypt.compareSync.mockReturnValue(false); // Simula contraseña incorrecta

      // AAA - Act
      const response = await request.post('/usuarios/logg').send(loginData);

      // AAA - Assert
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ ok: false, msg: 'Contraseña incorrecta' });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE mail = ? AND status = 'Activo'", [loginData.mail]);
      expect(bycrypt.compareSync).toHaveBeenCalledWith(loginData.pass, mockUser.pass);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería manejar errores de base de datos durante el login', async () => {
      // AAA - Arrange
      mockQuery.mockRejectedValueOnce(new Error('DB login error'));

      // AAA - Act
      const response = await request.post('/usuarios/logg').send(loginData);

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // AAA - Pruebas para DELETE /usuarios/:idUser (eliminar_Usuario)
  describe('DELETE /usuarios/:idUser', () => {
    const userId = 1;

    it('debería eliminar un usuario exitosamente (cambio de status a Inactivo)', async () => {
      // AAA - Arrange
      const existingUser = { idUser: userId, mail: 'delete@test.com', name: 'Delete User', area: 'HR', status: 'Activo', type: 'usuario' };
      mockQuery
        .mockResolvedValueOnce([[existingUser], []]) // Encuentra el usuario existente y no es admin
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Simula la actualización a Inactivo

      // AAA - Act
      const response = await request.delete(`/usuarios/${userId}`);

      // AAA - Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, msg: 'Usuario eliminado correctamente' });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE idUser = ? AND status = 'Activo' and type != 'admin'", [userId.toString()]);
      expect(mockQuery).toHaveBeenCalledWith("UPDATE usuarios SET status = 'Inactivo' WHERE idUser = ?", [userId.toString()]);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería retornar 404 si el usuario a eliminar no es encontrado, está inactivo o es admin', async () => {
      // AAA - Arrange
      mockQuery.mockResolvedValueOnce([[], []]); // Usuario no encontrado o es admin

      // AAA - Act
      const response = await request.delete(`/usuarios/${userId}`);

      // AAA - Assert
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ ok: false, msg: 'Usuario no encontrado' });
      expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM usuarios WHERE idUser = ? AND status = 'Activo' and type != 'admin'", [userId.toString()]);
      expect(mockQuery).not.toHaveBeenCalledWith("UPDATE usuarios SET status = 'Inactivo' WHERE idUser = ?", expect.any(Array));
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('debería manejar errores de base de datos durante la eliminación', async () => {
      // AAA - Arrange
      const existingUser = { idUser: userId, mail: 'delete@test.com', name: 'Delete User', area: 'HR', status: 'Activo', type: 'usuario' };
      mockQuery
        .mockResolvedValueOnce([[existingUser], []]) // Encuentra el usuario existente
        .mockRejectedValueOnce(new Error('DB delete error')); // Simula un error en la actualización

      // AAA - Act
      const response = await request.delete(`/usuarios/${userId}`);

      // AAA - Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, msg: 'Algo salió mal' });
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });
});
