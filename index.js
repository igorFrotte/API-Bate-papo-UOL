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



app.listen(5000);