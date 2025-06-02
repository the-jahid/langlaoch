import { Request, Response } from "express";
import { addMessage } from "../services/chat.service";
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




export {
    createChat
}









