import { Request, Response } from "express";
import { addMessage, getChatMessagesBySessionId } from "../services/chat.service";
import { ensureSessionExists } from "../utils/ensureSession";


const createChat = async (req:Request, res: Response) => {
   const { content} = req.body
   const { sessionId } = req.params;

   if(!sessionId || !content) {
      return res.status(400).json({ error: "Session ID and content are required" });
    }

      const session = await ensureSessionExists(sessionId);
    
        if (!session) {
        return res.status(404).json({ error: "Session not found" });
        }

        const agentId = session.agentId;

        if (!agentId) {

                return res.status(400).json({ error: "Agent ID is required" });
            }


    const result = await addMessage({sessionId, content, agentId})
      
    console.log("Chat message created:", result);
   return res.status(201).json(result);
}

const getChatMessagesBySessionIdcontroller = async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
    }
    const session = await ensureSessionExists(sessionId);
    if (!session) {
        return res.status(404).json({ error: "Session not found" });
    }

    const messages = await getChatMessagesBySessionId(sessionId);

    if (!messages) {
        return res.status(404).json({ error: "No messages found for this session" });
    }

    return res.status(200).json(messages);
}


export {
    createChat,
    getChatMessagesBySessionIdcontroller
}









