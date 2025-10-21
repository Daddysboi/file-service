import { z } from 'zod';

const IdSchema = z.object({
  id: z.string().trim().min(1),
});

const statusSchema = z.object({
  status: z.string().trim().min(1),
});

const isActiveSchema = z.object({
  status: z.boolean(),
});

const IdsSchema = z.object({
  ids: z.array(z.string().trim().min(1)),
});

const EmailSchema = z.object({
  email: z.string().min(1).trim().email(),
});

const Amount = z.object({
  amount: z.number().min(1),
});

const tokenSchema = z.object({
  token: z.string().trim().min(1),
});

const SearchSchema = z.object({
  id: z.string().trim().min(1).optional(),
  keyword: z.string().min(1).optional(),
});

const PaginationSchema = z.object({
  limit: z.string().trim().min(1).optional(),
  page: z.string().trim().min(1).optional(),
});

export const commonValidation = {
  IdSchema,
  IdsSchema,
  statusSchema,
  isActiveSchema,
  tokenSchema,
  EmailSchema,
  SearchSchema,
  PaginationSchema,
  Amount,
};
