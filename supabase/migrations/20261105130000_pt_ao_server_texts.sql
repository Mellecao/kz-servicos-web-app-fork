-- Português de Angola nos textos gerados pelo servidor (mensagens de RPC e notificações a admins).
-- Só reescreve o TEXTO de funções existentes (CREATE OR REPLACE via pg_get_functiondef); não toca em dados nem em lógica.
-- Verificado: nenhum app compara estas mensagens como texto.
DO $$
DECLARE
  r      record;
  v_def  text;
  v_new  text;
  i      integer;
  pairs  text[][] := ARRAY[
    -- frases completas primeiro
    ['Você já tem uma corrida Flash em andamento', 'Já tem uma viagem Flash em curso'],
    ['Você não é o motorista dessa corrida', 'Não é o motorista desta viagem'],
    ['Você já respondeu essa chamada', 'Já respondeu a esta chamada'],
    ['Você não foi convidado para essa corrida', 'Não foi convidado para esta viagem'],
    ['Você não foi convidado', 'Não foi convidado'],
    ['Voce nao tem candidatura pendente nesta corrida', 'Não tem candidatura pendente nesta viagem'],
    ['Não é sua corrida', 'Não é a sua viagem'],
    ['Usuário não autenticado', 'Utilizador não autenticado'],
    ['Corrida nao esta aguardando sua confirmacao', 'A viagem não está a aguardar a sua confirmação'],
    ['Corrida nao esta aguardando resposta do motorista', 'A viagem não está a aguardar resposta do motorista'],
    ['Corrida não está buscando motoristas', 'A viagem não está a procurar motoristas'],
    ['Corrida não está mais buscando', 'A viagem já não está à procura de motorista'],
    ['Corrida não pode mais ser cancelada', 'A viagem já não pode ser cancelada'],
    ['Corrida nao pode ser cancelada no status %', 'A viagem não pode ser cancelada no estado %'],
    ['Corrida não encontrada', 'Viagem não encontrada'],
    ['Corrida nao encontrada', 'Viagem não encontrada'],
    ['A corrida já está finalizada', 'A viagem já está finalizada'],
    ['Sem preco proposto para esta corrida', 'Sem preço proposto para esta viagem'],
    ['Corrida cancelada pela KZ', 'Viagem cancelada pela Só Serviços'],
    ['aguardando análise', 'a aguardar análise'],
    ['equipe KZ', 'equipa Só Serviços'],
    ['pela KZ', 'pela Só Serviços'],
    -- palavras soltas por último
    ['corridas', 'viagens'], ['Corridas', 'Viagens'],
    ['corrida', 'viagem'],   ['Corrida', 'Viagem']
  ];
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'advance_trip_execution','cancel_flash_trip','cancel_scheduled_choose_driver_trip',
        'client_accept_flash_proposal','client_accept_scheduled_price','client_reject_scheduled_price',
        'client_send_scheduled_direct_request','create_flash_trip','driver_accept_scheduled_direct',
        'driver_flash_recheck_confirm','driver_flash_recheck_reject','driver_reject_scheduled_direct',
        'driver_send_flash_proposal','notify_admins_on_trip_cancellation_request','redispatch_flash_trip',
        'reject_flash_call','reject_trip_candidates_when_cancelled',
        'trigger_admin_notification_on_candidate_update','trigger_admin_notification_on_trip_insert',
        'trigger_admin_notification_on_trip_status'
      ])
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_new := v_def;
    FOR i IN 1 .. array_length(pairs, 1) LOOP
      v_new := replace(v_new, pairs[i][1], pairs[i][2]);
    END LOOP;
    IF v_new IS DISTINCT FROM v_def THEN
      EXECUTE v_new;
    END IF;
  END LOOP;
END $$;
