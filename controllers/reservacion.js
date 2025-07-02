const db = require("../config/mysql");
const {areIntervalsOverlapping, generarCodigoAlfanumericoAleatorio, obtenerSemanaActualDomingoASabado} = require("../helpers/tiempo");

const registrar_reservacion = async (req, res) => {
    const {idSala, nombre, correo, area, fecha, hora_inicio, hora_fin} = req.body;
    const con = await db.getConnection();

    try{
        const [reservaciones_previas] = await con.query("SELECT hora_inicio, hora_fin FROM reservacion WHERE idSala = ? AND fecha = ?", [idSala, fecha]);

        for (const resv of reservaciones_previas){
            if(areIntervalsOverlapping(resv.hora_inicio, resv.hora_fin, hora_inicio, hora_fin)){
                return res.status(400).json({ok: false, "msg": "Ya está reservado en el lapso seleccionado"});
            }
        }

        const code = await generarCodigoUnico(8);
        const obj = [idSala, code, nombre, correo, area, fecha, hora_inicio, hora_fin];
        await con.query("INSERT INTO reservacion(idSala, codigo, nombre, correo, area, fecha, hora_inicio, hora_fin) VALUES(?, ?, ?, ?, ?, ?, ?, ?)", obj);
        
        return res.status(200).json({ok: true, codigo: code});
    }catch(err){
        console.log(err);
        return res.status(500).json({ok: false, msg: 'Algo salió mal'});
    }finally{
        con.release();
    }
}

const generarCodigoUnico = async (longitudCodigo = 8) => {
    let codigoGenerado;
    let codigoExiste = true;

    // Bucle para generar códigos hasta encontrar uno que no exista
    while (codigoExiste) {
        codigoGenerado = generarCodigoAlfanumericoAleatorio(longitudCodigo);
        codigoExiste = await existeCodigoEnDB(codigoGenerado);
    }
    return codigoGenerado;
}

const existeCodigoEnDB = async (codigo) => {
    const con = await db.getConnection()
    try {
        const [rows] = await con.execute('SELECT count(codigo) AS cod FROM reservacion WHERE codigo = ?', [codigo]);
        return rows[0].cod > 0; // Retorna true si el código existe, false si no
    } catch (error) {
        console.log(err);
        res.status(500).json({ok: false, msg: 'Algo salió mal'});
    } finally {
        con.release();
    }
}


const obtener_reservaciones = async (req, res) => {
    const semana = obtenerSemanaActualDomingoASabado();
    const con = await db.getConnection();
    const {sala} = req.params;

    try{
        const [reservaciones] = await con.query("SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, hora_inicio, hora_fin, status from reservacion WHERE idSala = ? AND fecha BETWEEN ? AND ?", [sala, semana.inicio, semana.fin]);
        console.log(reservaciones);
        return res.status(200).json({ok: true});
    }catch(err){
        console.log(err);
        return res.status(500).json({ok: false, msg: 'Algo salió mal'});
    }finally{
        con.release();
    }
}

module.exports = {
    registrar_reservacion,
    obtener_reservaciones
}