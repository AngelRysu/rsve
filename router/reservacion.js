const { Router } = require("express");
const {registrar_reservacion, obtener_reservaciones} = require("../controllers/reservacion")

const routerReservacion = Router();

routerReservacion.post('/', registrar_reservacion);
routerReservacion.get('/:sala', obtener_reservaciones);

module.exports = routerReservacion;