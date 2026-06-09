-- refresh_org_promoter_claim_token es SECURITY DEFINER y no valida auth en su
-- cuerpo (rota el claim_token de cualquier org_promoter por id). Estaba ejecutable
-- por anon/authenticated vía /rest/v1/rpc → un atacante podía rotar/invalidar
-- claim tokens de cualquier promotor. La app SOLO la llama con service_role
-- (supabaseAdmin), así que la cerramos a PUBLIC y damos EXECUTE solo a service_role.
revoke execute on function refresh_org_promoter_claim_token(uuid) from public, anon, authenticated;
grant execute on function refresh_org_promoter_claim_token(uuid) to service_role;
