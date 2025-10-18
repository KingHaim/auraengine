export interface User {
  id: string;
  email: string;
  name?: string;
  created_at: string;
}

export interface Credit {
  user_id: string;
  balance: number;
  updated_at: string;
}

export interface Asset {
  id: string;
  user_id: string;
  url: string;
  mime?: string;
  width?: number;
  height?: number;
  has_alpha: boolean;
  created_at: string;
}

export interface Template {
  id: string;
  label: string;
  mode: 'object' | 'tryon' | 'packshot';
  prompt: string;
  negative_prompt?: string;
  control?: any;
  placement?: any;
  created_at: string;
}

export interface Job {
  id: string;
  user_id: string;
  asset_id: string;
  template_id?: string;
  mode: 'object' | 'tryon' | 'packshot';
  status: 'queued' | 'processing' | 'done' | 'failed';
  engine?: string;
  seed?: number;
  outputs?: string[];
  options?: any;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface GenerationRequest {
  asset_id: string;
  template_id?: string;
  mode: 'object' | 'tryon' | 'packshot';
  engine?: 'gemini';
  variants?: number;
  options?: {
    angle?: 'front' | 'three_quarter' | 'side' | 'top';
    background?: 'white' | 'light_gray' | 'transparent' | 'gradient';
    reflection?: boolean;
    shadow_strength?: number;
  };
}

export interface GenerationResponse {
  job_id: string;
  status: string;
  urls?: string[];
}

