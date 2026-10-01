-- Routera is no longer offered as a document-assistant provider; OpenRouter
-- replaces it. A site still set to Routera moves to OpenRouter with its
-- default model, since Routera model names may not exist on OpenRouter.

update public.settings
set value = 'google/gemini-2.5-flash', updated_at = now()
where key = 'assistant_model'
  and exists (select 1 from public.settings where key = 'assistant_provider' and value = 'routera');

update public.settings
set value = 'openrouter', updated_at = now()
where key = 'assistant_provider' and value = 'routera';
