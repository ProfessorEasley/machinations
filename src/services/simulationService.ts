import { apiFetch } from '../config/api';

export interface CreateSimulationPayload {
  graph_id: number;
  name?: string;
  max_steps?: number;
  step_duration?: number;
  configuration?: Record<string, any>;
}

export interface SimulationSession {
  id: number;
  status: string;
  current_step: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const simulationService = {
  async create(token: string, payload: CreateSimulationPayload): Promise<SimulationSession> {
    const res = await apiFetch<ApiResponse<SimulationSession>>('/simulations', {
      method: 'POST',
      body: payload,
      token,
    });
    return res.data;
  },

  async execute(token: string, id: number) {
    await apiFetch<ApiResponse<unknown>>(`/simulations/${id}/execute`, {
      method: 'POST',
      token,
    });
  },
};


