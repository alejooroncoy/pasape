-- Comisiones flexibles para org_promoters y override por evento en promoter_links.
--
-- 3 tipos de comisión que vimos en campo (entrevista Paula):
--   percentage : %  por venta (lo que ya teníamos)
--   tiered     : escalones por cantidad (50 ventas → S/ 100, 100 → S/ 250)
--   inkind     : especie (botella al llegar a 40, pase VIP al llegar a 60)
--
-- Forma del jsonb commission_config:
--   percentage: null (el % vive en default_commission_pct, columna existente)
--   tiered: { "tiers": [{ "salesCount": 50, "payoutCents": 10000 }, ...] }
--   inkind: { "rewards": [{ "salesCount": 40, "label": "Botella", "icon": "🍾" }, ...] }
--
-- El override por evento (promoter_links.commission_config_override) permite a un
-- evento sobreescribir el % o agregar tiers/rewards específicos. Si es null, hereda.

alter table org_promoters
  add column commission_type text not null default 'percentage'
    check (commission_type in ('percentage', 'tiered', 'inkind')),
  add column commission_config jsonb;

alter table promoter_links
  add column commission_config_override jsonb;

-- Backfill: todos los existentes son percentage (ya tienen commission_pct).
-- (Sin cambios necesarios — el default cubre.)
