# GoAlert On-Call Setup Guide

Quick-start guide for configuring incident management and phone notifications.

## 🚀 Access

**GoAlert UI:** http://localhost:8081

## 📋 Initial Setup (First Time Only)

1. **Open GoAlert UI** → First-time setup wizard appears
2. **Create Admin Account**
   - Username: `<your-name>` (or your preference)
   - Password: (choose a secure password)
   - Email: `<you@example.com>`

## 🛠️ Configuration Steps

### Step 1: Add Contact Methods
1. Go to **Profile** → **Contact Methods**
2. Add phone number for SMS/voice alerts
3. Add email for backup notifications

### Step 2: Create a Service
1. Go to **Services** → **Create New Service**
2. Name: `Krystaline Production`
3. Description: `Primary crypto exchange platform`

### Step 3: Create Escalation Policy
1. Go to **Escalation Policies** → **Create**
2. Name: `Primary On-Call`
3. Add steps:
   - Step 1 (0 min delay): Notify primary on-call user
   - Step 2 (15 min delay): Notify backup user
   - Step 3 (30 min delay): Notify entire team

### Step 4: Create Integration Key
1. Open your Service → **Integration Keys** tab
2. Click **Create Integration Key**
3. Type: `Generic API`
4. Copy the key (looks like: `abc123def456...`)

### Step 5: Connect Alertmanager
Put the integration key into the GoAlert webhook URLs in `config/alertmanager.yml` — each receiver embeds its key as a `token=` query parameter:
```yaml
- name: 'goalert-webhook'
  webhook_configs:
    - url: 'http://goalert:8081/api/v2/prometheusalertmanager/incoming?token=YOUR_INTEGRATION_KEY'
```

Restart alertmanager to pick up the change:
```bash
docker-compose restart alertmanager
```

> Note: docker-compose.yml also mounts `config/alertmanager/goalert-token` into the Alertmanager container, but the current `config/alertmanager.yml` does not read that file — the `token=` parameters in the webhook URLs are what connect the two.

## 📱 Phone Notifications (Twilio)

To enable SMS/Voice calls:

1. **Create Twilio Account** → https://www.twilio.com
2. **Get Credentials:**
   - Account SID
   - Auth Token
   - Twilio Phone Number
3. **Configure GoAlert:**
   - Go to **Admin** → **Config**
   - Set Twilio credentials

## 🧪 Test Alerts

### Fire a Test Alert via curl:
```powershell
curl -X POST http://localhost:8081/api/v2/generic/incoming `
  -H "Authorization: Bearer YOUR_INTEGRATION_KEY" `
  -H "Content-Type: application/json" `
  -d '{"summary":"Test Alert","details":"Testing oncall notification"}'
```

### Or trigger via Alertmanager:
Alerts from Prometheus rules will automatically route through Alertmanager → GoAlert.

## 📂 Files

| File | Purpose |
|------|---------|
| `config/alertmanager.yml` | Routes alerts to GoAlert webhooks (integration keys embedded as `token=` params) |
| `config/alertmanager/goalert-token` | Mounted into the container but not read by the current config |
| `docker-compose.yml` | GoAlert v0.33.0 (port 8081) + its own PostgreSQL |

## 🔗 Integration Flow

```
Prometheus → Alertmanager → GoAlert → Phone/SMS/Email
     ↓              ↓
  (rules)    (<you@example.com>)
```

## 🚨 Alert Routing (Current Config)

Per `config/alertmanager.yml`:

- **Critical alerts** → GoAlert + email + ntfy.sh mobile push (`priority=urgent`)
- **Warning alerts** → GoAlert, batched (1m group wait, 4h repeat)
- **Security alerts** (`service: security`) → GoAlert Generic API, immediate
- **PriceFeedUnavailable** → auto-remediation webhook on the API first, then continues to GoAlert
- **NoTraffic** → self-healing traffic ping, then continues to GoAlert

---

**Need help?** GoAlert docs: https://goalert.me/docs
