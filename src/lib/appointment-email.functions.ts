import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppointmentEmailInput = {
  clientEmail: string;
  clientName: string;
  serviceName: string;
  price: number;
  startsAt: string;
  duration: number;
};

export const sendAppointmentConfirmationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AppointmentEmailInput) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env["RESEND_API_KEY"];
    const from = process.env["RESEND_FROM_EMAIL"];
    if (!apiKey || !from || !data.clientEmail) return { sent: false as const };

    const date = new Date(data.startsAt).toLocaleString("pt-PT", {
      dateStyle: "long",
      timeStyle: "short",
    });
    const amount = new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(data.price);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [data.clientEmail],
        subject: `Marcação confirmada — ${data.serviceName}`,
        html: `<!doctype html><html lang="pt"><body style="margin:0;background:#f7f5f1;font-family:Arial,sans-serif;color:#24211d"><div style="max-width:620px;margin:32px auto;background:#fff;border:1px solid #e8e2d8;border-radius:18px;padding:32px"><h1 style="margin:0 0 8px;font-size:24px">Marcação confirmada</h1><p style="color:#6b665f">Olá ${data.clientName}, a sua marcação foi registada com sucesso.</p><div style="margin:24px 0;padding:20px;border-radius:14px;background:#faf8f4"><p><strong>Serviço:</strong> ${data.serviceName}</p><p><strong>Data e hora:</strong> ${date}</p><p><strong>Duração:</strong> ${data.duration} minutos</p><p><strong>Valor:</strong> ${amount}</p></div><p style="color:#6b665f">Se precisar de alterar a marcação, entre em contacto connosco.</p><p style="margin-top:28px">Até breve!</p></div></body></html>`,
      }),
    });

    if (!response.ok) return { sent: false as const };
    return { sent: true as const };
  });
