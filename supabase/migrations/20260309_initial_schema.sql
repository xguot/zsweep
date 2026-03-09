-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.game_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  mode text NOT NULL,
  setting text NOT NULL,
  win boolean NOT NULL,
  grids integer,
  accuracy integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  total_mines integer DEFAULT 0,
  time integer DEFAULT 0,
  CONSTRAINT game_results_pkey PRIMARY KEY (id),
  CONSTRAINT game_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  username text UNIQUE,
  avatar_url text,
  updated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
