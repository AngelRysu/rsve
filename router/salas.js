const { Router } = require("express");
const { registrar_Sala, obtener_Salas, obtener_Sala_One, modificar_Sala,  eliminar_Sala } = require('../controllers/salas');

const routerNoticias = Router();

routerNoticias.post('/', registrar_Sala);
routerNoticias.get('/', obtener_Salas);
routerNoticias.get('/:idSala', obtener_Sala_One);
routerNoticias.put('/:idSala', modificar_Sala);
routerNoticias.delete('/:idSala', eliminar_Sala);

module.exports = routerNoticias;