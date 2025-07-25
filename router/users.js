const { Router } = require("express");
const { 
    registrar_usuario,
    obtener_Usuarios,
    obtener_Usuario_One,
    modificar_Usuario,
    eliminar_Usuario,
    Logg } = require('../controllers/users');

const routerNoticias = Router();

routerNoticias.post('/', registrar_usuario);
routerNoticias.get('/', obtener_Usuarios);
routerNoticias.get('/:idUser', obtener_Usuario_One);
routerNoticias.put('/:idUser',modificar_Usuario );
routerNoticias.delete('/:idUser', eliminar_Usuario);
routerNoticias.post('/logg/',Logg );

module.exports = (app) => app.use('/usuarios',routerNoticias);
