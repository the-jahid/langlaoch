import { z } from 'zod';
import { ModelType, AgentStatus } from '@prisma/client';

export const CreateAgentSchema = z.object({
  name: z.string({
    required_error: 'Name is required',
    invalid_type_error: 'Name must be a string',
  }).min(1, 'Name cannot be empty').max(255, 'Name must be at most 255 characters'),

  systemPrompt: z.string({
    required_error: 'System prompt is required',
  }).max(10_000, 'System prompt must be at most 10,000 characters'),

  model: z.nativeEnum(ModelType, {
    errorMap: () => ({ message: 'Selected model is invalid' }),
  }).default(ModelType.GPT_3_5_TURBO),

  temperature: z.number({
    invalid_type_error: 'Temperature must be a number',
  }).min(0, 'Temperature must be at least 0').max(2, 'Temperature must be at most 2').optional(),
});

export const GetAgentSchema = z.object({
  agentId: z.string().uuid('agentId must be a valid UUID'),
});


export const UpdateAgentSchema = z.object({

  body: z.object({
    name: z.string().min(1, 'Name cannot be empty').max(255, 'Name must be at most 255 characters').optional(),

    systemPrompt: z.string().max(10_000, 'System prompt must be at most 10,000 characters').optional(),

    model: z.nativeEnum(ModelType, {
      errorMap: () => ({ message: 'Selected model is invalid' }),
    }).optional(),

    temperature: z.number().min(0, 'Temperature must be at least 0').max(2, 'Temperature must be at most 2').optional(),


  }).optional(),
});

export const DeleteAgentSchema = z.object({
  agentId: z.string().uuid('agentId must be a valid UUID'),
});
