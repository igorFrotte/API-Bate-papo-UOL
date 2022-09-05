import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from "mongodb";
import joi from 'joi';
import dayjs from 'dayjs';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;

mongoClient.connect().then(() => {
  db = mongoClient.db("batepapoUOL");
});

const nameSchema = joi.object({
  name: joi.string().required()
});

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().required().valid('message','private_message')
});

setInterval( async () => {
  const realTime = Date.now();

  try {
    const users = await db.collection("participante").find().toArray()

    users.map( async (e) => {
      if(realTime - e.lastStatus > 10000){
        await db
          .collection("participante")
          .deleteOne({_id: ObjectId(e._id)});
        await db
          .collection("mensagem")
          .insertOne({
            from: e.name, 
            to: 'Todos', 
            text: 'sai da sala...', 
            type: 'status', 
            time: dayjs().format("HH:mm:ss") 
          });
      } 
    });
  } catch (error) {
    console.log(error);
  }
}, 15000)

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const validation = nameSchema.validate(req.body, { abortEarly: false });

  if (validation.error) {
    const erros = validation.error.details.map((detail) => detail.message);
    res.status(422).send(erros);
    return;
  }

  try {
    const userExist = await db
      .collection("participante")
      .findOne({ name });

    if(userExist){
      res.status(409).send("Usuário existente");
      return;
    }

    await db
      .collection("participante")
      .insertOne({ name, lastStatus: Date.now() });
    
    await db
      .collection("mensagem")
      .insertOne({
        from: name, 
        to: 'Todos', 
        text: 'entra na sala...', 
        type: 'status', 
        time: dayjs(new Date()).format('HH:mm:ss')
      });

    res.status(201).send(); 
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const response = await db.collection("participante").find().toArray();
    res.send(response);
  } catch (error) {
    res.sendStatus(500).send(error.message);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;

  const validation = messageSchema.validate(req.body, { abortEarly: false });

  try {
    const userExist = await db
      .collection("participante")
      .findOne({ name: user });
    
    if(!userExist){
      res.status(422).send("Usuário não existe");
      return;
    }

    if(validation.error) {
      const erros = validation.error.details.map((detail) => detail.message);
      res.status(422).send(erros);
      return;
    }
    
    await db
      .collection("mensagem")
      .insertOne({
        from: user, 
        to, 
        text, 
        type, 
        time: dayjs(new Date()).format('HH:mm:ss')
      });

    res.status(201).send(); 
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/messages", async (req, res) => {
  const { user } = req.headers;
  const limit = parseInt(req.query.limit);

  try {
    const response = await db.collection("mensagem").find().toArray();
    const msgs = response.filter((e) => e.to === "Todos" || e.to === user || e.from === user || e.type === "message");

    res.send(msgs.slice(limit*-1));
  } catch (error) {
    res.sendStatus(500).send(error.message);
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;

  try {
    const userExist = await db
      .collection("participante")
      .findOne({ name: user });
    
    if(!userExist){
      res.status(404).send();
      return;
    }

    await db
      .collection("participante")
      .updateOne(
        { _id: userExist._id }, 
        { $set: {lastStatus: Date.now()} }
      );

    res.status(200).send(); 
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(5000);