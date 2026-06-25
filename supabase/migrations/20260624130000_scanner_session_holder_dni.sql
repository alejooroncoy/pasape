-- El portero se identifica con NOMBRE + DNI completo al canjear el código.
-- Accountability: cada scan queda atado a una persona identificable (no a un
-- nombre tecleable que podría ser falso). El DNI completo vive SOLO aquí,
-- server-side; NO se cachea en los dispositivos (a diferencia del last2 que ya
-- existe para display). `dni_last2` se mantiene como columna derivada para
-- mostrar "··42" sin exponer el número completo.
alter table scanner_sessions add column if not exists holder_dni text;
