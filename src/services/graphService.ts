import { apiFetch } from '../config/api';

export interface GraphSummary {
  id: number;
  name: string;
}

export interface GraphListResponse {
  success: boolean;
  data: GraphSummary[];
}

export const graphService = {
  async list(token: string | null) {
    const res = await apiFetch<GraphListResponse>('/graphs', { token });
    return res.data;
  },
};


