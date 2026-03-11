-- Trigger: when meals_remaining drops to 0 and auto_renew is TRUE,
-- automatically insert a new subscription with the same plan.
CREATE OR REPLACE FUNCTION auto_renew_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_meals_count INT;
BEGIN
  IF NEW.meals_remaining = 0
     AND NEW.auto_renew = TRUE
     AND OLD.meals_remaining > 0
  THEN
    SELECT meals_count INTO v_meals_count
    FROM subscription_plans
    WHERE id = NEW.plan_id AND is_active = TRUE;

    IF FOUND THEN
      INSERT INTO subscriptions (profile_id, plan_id, meals_remaining, status, auto_renew)
      VALUES (NEW.profile_id, NEW.plan_id, v_meals_count, 'active', TRUE);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_renew_subscription
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION auto_renew_subscription();
