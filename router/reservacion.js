const { Router } = require("express");
const {registrar_reservacion, obtener_reservaciones, confirmar_reservacion, obtener_reservaciones_dia, validar_reservas, obtener_reservas, cancelar_reservacion, obtener_reservas_all } = require("../controllers/reservacion")

const routerReservacion = Router();

routerReservacion.post('/', registrar_reservacion);
routerReservacion.get('/:sala', obtener_reservaciones);
routerReservacion.get('/dia/:dia/:sala', obtener_reservaciones_dia);
routerReservacion.get('/confirmar/:code', confirmar_reservacion);
routerReservacion.post('/validation/', validar_reservas);
routerReservacion.post('/reservas/', obtener_reservas);
routerReservacion.post('/reservas/all', obtener_reservas_all);
routerReservacion.delete('/cancelar/:code', cancelar_reservacion);

module.exports = routerReservacion;