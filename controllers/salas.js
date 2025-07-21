const db = require("../config/mysql");

// En tu controlador/salas.js
const registrar_Sala = async (req, res) => {
    const {nombre, descripcion} = req.body;

    const con = await db.getConnection();
    try{
        const [Salas] = await con.query("SELECT * FROM salas WHERE visible = 1"); 
        
        if (Salas.some(sala => sala.nombre === nombre)) {
            return res.status(400).json({ok: false, msg: "El nombre de la sala ya existe"});
        }
        
        await con.query("INSERT INTO salas(nombre, descripcion) VALUES(?, ?);", [nombre, descripcion]);

        return res.status(201).json({ok: true, msg: "Sala creada exitosamente"});
    }catch(err){
        console.log(err);
        res.status(500).json({ok: false, msg: 'Algo salió mal'});
    }finally{
        con.release();
    }
}

const obtener_Salas = async (req, res) => {
    const con = await db.getConnection();
    try {
        const [Salas] = await con.query("SELECT * FROM salas WHERE visible = 1");

        const final_Json = Salas.map(sala => ({
            idSala: sala.idSala,
            nombre: sala.nombre,
            descripcion: sala.descripcion,
        }));

        return res.status(200).json(final_Json);
    } catch (err) {
        console.log(err);
        res.status(500).json({ ok: false, msg: 'Algo salió mal' });
    } finally {
        con.release();
    }
};


const obtener_Sala_One = async (req, res) => {
    const { idSala } = req.params;
    const con = await db.getConnection();
    try {
        const [Salas] = await con.query("SELECT * FROM salas WHERE idSala = ? AND visible = 1", [idSala]);
        if (Salas.length === 0) {
            return res.status(404).json({ ok: false, msg: "Sala no encontrada" });
        }

        const Sala = Salas[0];

        const result = {
            idSala: Sala.idSala,
            nombre: Sala.nombre, 
            descripcion: Sala.descripcion,
        };

        return res.status(200).json(result);
    } catch (err) {
        console.log(err);
        res.status(500).json({ ok: false, msg: 'Algo salió mal' });
    } finally {
        con.release();
    }
}

const modificar_Sala = async (req, res) => {
    const { idSala } = req.params;
    const { nombre, descripcion } = req.body;
    const con = await db.getConnection();
    try {
        const [Salas] = await con.query("SELECT * FROM salas WHERE idSala = ? AND visible = 1", [idSala]);
        if (Salas.length === 0) {
            return res.status(404).json({ ok: false, msg: "Sala no encontrada" });
        }

        await con.query(
            "UPDATE salas SET nombre = ?, descripcion = ? WHERE idSala = ?",
            [nombre, descripcion, idSala]
        );

        const [updatedSalaRows] = await con.query("SELECT * FROM salas WHERE idSala = ?", [idSala]);
        const Sala = updatedSalaRows[0];

        const result = {
            idSala: Sala.idSala,
            nombre: Sala.nombre, 
            descripcion: Sala.descripcion,
        };

        return res.status(200).json(result);
    } catch (err) {
        console.log(err);
        res.status(500).json({ ok: false, msg: 'Algo salió mal' });
    } finally {
        con.release();
    }
}

const eliminar_Sala = async (req, res) => {
    const { idSala } = req.params;
    const con = await db.getConnection();
    try {
        const [Salas] = await con.query("SELECT * FROM salas WHERE idSala = ? AND visible = 1", [idSala]);
        if (Salas.length === 0) {
            return res.status(404).json({ ok: false, msg: "Sala no encontrada" });
        }

        await con.query("UPDATE salas SET visible = 0 WHERE idSala = ?", [idSala]);

        return res.status(200).json({ ok: true, msg: "Sala eliminada exitosamente" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ ok: false, msg: 'Algo salió mal' });
    } finally {
        con.release();
    }
}

module.exports = {registrar_Sala, obtener_Salas, obtener_Sala_One, modificar_Sala, eliminar_Sala}