import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Documentação do Banco de Dados — KZ Serviços',
  description: 'Documentação completa do schema do banco de dados Supabase do KZ Serviços.',
}

type Column = {
  name: string
  type: string
  constraints: string
}

type TableDoc = {
  id: string
  name: string
  description: string
  columns: Column[]
  notes?: string[]
}

type EnumDoc = {
  name: string
  values: string[]
}

const enums: EnumDoc[] = [
  { name: 'user_role', values: ['client', 'provider', 'admin'] },
  { name: 'provider_status', values: ['pending', 'approved', 'rejected', 'suspended'] },
  { name: 'bank_account_type', values: ['checking', 'savings'] },
  {
    name: 'trip_status',
    values: [
      'open', 'under_review', 'review_rejected', 'searching_drivers',
      'awaiting_client_confirmation', 'awaiting_driver_confirmation',
      'scheduled', 'started', 'finished', 'cancelled',
    ],
  },
  {
    name: 'service_request_status',
    values: [
      'open', 'under_review', 'review_rejected', 'searching_provider',
      'assigned', 'in_progress', 'finished', 'cancelled',
    ],
  },
  { name: 'service_type_enum', values: ['trip', 'other_service'] },
  { name: 'payment_method', values: ['pix', 'debit', 'credit', 'cash', 'billing'] },
  { name: 'luggage_size', values: ['small', 'medium', 'large', 'extra_large'] },
  { name: 'platform_type', values: ['android', 'ios', 'web'] },
  { name: 'message_type', values: ['text', 'image', 'audio', 'file', 'location'] },
  { name: 'photo_type', values: ['front', 'back', 'interior', 'side_left', 'side_right'] },
]

const tables: TableDoc[] = [
  {
    id: 'users',
    name: 'users',
    description: 'Tabela principal de usuários, vinculada ao auth.users do Supabase Auth.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK — referencia auth.users.id' },
      { name: 'role', type: 'user_role', constraints: 'NOT NULL, DEFAULT \'client\'' },
      { name: 'full_name', type: 'VARCHAR(255)', constraints: 'NOT NULL' },
      { name: 'email', type: 'VARCHAR(255)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'phone', type: 'VARCHAR(20)', constraints: '' },
      { name: 'cpf', type: 'VARCHAR(14)', constraints: 'UNIQUE' },
      { name: 'avatar_url', type: 'TEXT', constraints: '' },
      { name: 'date_of_birth', type: 'DATE', constraints: '' },
      { name: 'is_active', type: 'BOOLEAN', constraints: 'DEFAULT true' },
      { name: 'auth_provider', type: 'VARCHAR(20)', constraints: '' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
      { name: 'deleted_at', type: 'TIMESTAMPTZ', constraints: '' },
    ],
  },
  {
    id: 'service_categories',
    name: 'service_categories',
    description: 'Categorias de serviço disponíveis na plataforma (ex: transporte, mudança, etc).',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'name', type: 'VARCHAR(100)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'slug', type: 'VARCHAR(100)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'description', type: 'TEXT', constraints: '' },
      { name: 'service_type', type: 'service_type_enum', constraints: 'NOT NULL' },
      { name: 'is_active', type: 'BOOLEAN', constraints: 'DEFAULT true' },
      { name: 'icon_url', type: 'TEXT', constraints: '' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
  },
  {
    id: 'provider_profiles',
    name: 'provider_profiles',
    description: 'Perfis de prestadores de serviço com dados bancários, documentos e status de aprovação.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'user_id', type: 'UUID', constraints: 'FK → users, UNIQUE, NOT NULL' },
      { name: 'service_category_id', type: 'UUID', constraints: 'FK → service_categories, NOT NULL' },
      { name: 'status', type: 'provider_status', constraints: 'DEFAULT \'pending\'' },
      { name: 'rg_document_url', type: 'TEXT', constraints: '' },
      { name: 'cnh_document_url', type: 'TEXT', constraints: '' },
      { name: 'proof_of_address_url', type: 'TEXT', constraints: '' },
      { name: 'has_card_machine', type: 'BOOLEAN', constraints: 'DEFAULT false' },
      { name: 'has_tap_payment', type: 'BOOLEAN', constraints: 'DEFAULT false' },
      { name: 'issues_invoice', type: 'BOOLEAN', constraints: 'DEFAULT false' },
      { name: 'issues_receipt', type: 'BOOLEAN', constraints: 'DEFAULT false' },
      { name: 'bank_name', type: 'VARCHAR(100)', constraints: '' },
      { name: 'bank_agency', type: 'VARCHAR(20)', constraints: '' },
      { name: 'bank_account', type: 'VARCHAR(30)', constraints: '' },
      { name: 'bank_account_type', type: 'bank_account_type', constraints: '' },
      { name: 'bank_pix_key', type: 'VARCHAR(255)', constraints: '' },
      { name: 'average_rating', type: 'DECIMAL(3,2)', constraints: 'DEFAULT 0' },
      { name: 'total_ratings', type: 'INTEGER', constraints: 'DEFAULT 0' },
      { name: 'bio', type: 'TEXT', constraints: '' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
  },
  {
    id: 'driver_profiles',
    name: 'driver_profiles',
    description: 'Perfil específico de motoristas, vinculado a um provider_profile.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'provider_profile_id', type: 'UUID', constraints: 'FK → provider_profiles, UNIQUE, NOT NULL' },
      { name: 'cnh_category', type: 'VARCHAR(5)', constraints: '' },
      { name: 'cnh_expiration_date', type: 'DATE', constraints: '' },
      { name: 'cnh_number', type: 'VARCHAR(20)', constraints: 'UNIQUE' },
      { name: 'is_available', type: 'BOOLEAN', constraints: 'DEFAULT false' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
  },
  {
    id: 'vehicles',
    name: 'vehicles',
    description: 'Veículos cadastrados por motoristas.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'driver_profile_id', type: 'UUID', constraints: 'FK → driver_profiles, NOT NULL' },
      { name: 'brand', type: 'VARCHAR(100)', constraints: 'NOT NULL' },
      { name: 'model', type: 'VARCHAR(100)', constraints: 'NOT NULL' },
      { name: 'year', type: 'INTEGER', constraints: 'NOT NULL' },
      { name: 'color', type: 'VARCHAR(50)', constraints: 'NOT NULL' },
      { name: 'license_plate', type: 'VARCHAR(10)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'vehicle_document_url', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'passenger_capacity', type: 'INTEGER', constraints: 'DEFAULT 4' },
      { name: 'is_active', type: 'BOOLEAN', constraints: 'DEFAULT true' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
  },
  {
    id: 'vehicle_photos',
    name: 'vehicle_photos',
    description: 'Fotos dos veículos categorizadas por ângulo/tipo.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'vehicle_id', type: 'UUID', constraints: 'FK → vehicles, ON DELETE CASCADE, NOT NULL' },
      { name: 'photo_url', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'photo_type', type: 'photo_type', constraints: 'NOT NULL' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
  },
  {
    id: 'addresses',
    name: 'addresses',
    description: 'Endereços utilizados em viagens e solicitações. O campo location é auto-populado via trigger.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'google_place_id', type: 'VARCHAR(255)', constraints: '' },
      { name: 'formatted_address', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'street', type: 'VARCHAR(255)', constraints: '' },
      { name: 'number', type: 'VARCHAR(20)', constraints: '' },
      { name: 'complement', type: 'VARCHAR(255)', constraints: '' },
      { name: 'neighborhood', type: 'VARCHAR(255)', constraints: '' },
      { name: 'city', type: 'VARCHAR(255)', constraints: 'NOT NULL' },
      { name: 'state', type: 'VARCHAR(2)', constraints: 'NOT NULL' },
      { name: 'zip_code', type: 'VARCHAR(10)', constraints: '' },
      { name: 'latitude', type: 'DECIMAL(10,7)', constraints: 'NOT NULL' },
      { name: 'longitude', type: 'DECIMAL(10,7)', constraints: 'NOT NULL' },
      { name: 'location', type: 'GEOGRAPHY(Point,4326)', constraints: 'Auto-populado via trigger' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
  },
  {
    id: 'trips',
    name: 'trips',
    description: 'Viagens solicitadas pelos clientes. Contém origem, destino, status, preços e informações de pagamento.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'client_id', type: 'UUID', constraints: 'FK → users, NOT NULL' },
      { name: 'driver_profile_id', type: 'UUID', constraints: 'FK → driver_profiles' },
      { name: 'vehicle_id', type: 'UUID', constraints: 'FK → vehicles' },
      { name: 'service_category_id', type: 'UUID', constraints: 'FK → service_categories, NOT NULL' },
      { name: 'pickup_address_id', type: 'UUID', constraints: 'FK → addresses, NOT NULL' },
      { name: 'dropoff_address_id', type: 'UUID', constraints: 'FK → addresses, NOT NULL' },
      { name: 'scheduled_datetime', type: 'TIMESTAMPTZ', constraints: 'NOT NULL' },
      { name: 'is_round_trip', type: 'BOOLEAN', constraints: 'DEFAULT false' },
      { name: 'return_datetime', type: 'TIMESTAMPTZ', constraints: '' },
      { name: 'passenger_count', type: 'INTEGER', constraints: 'NOT NULL' },
      { name: 'children_count', type: 'INTEGER', constraints: 'DEFAULT 0' },
      { name: 'observations', type: 'TEXT', constraints: '' },
      { name: 'driver_observations', type: 'TEXT', constraints: '' },
      { name: 'luggage_count', type: 'INTEGER', constraints: 'DEFAULT 0' },
      { name: 'status', type: 'trip_status', constraints: 'DEFAULT \'open\'' },
      { name: 'estimated_price', type: 'DECIMAL(10,2)', constraints: '' },
      { name: 'final_price', type: 'DECIMAL(10,2)', constraints: '' },
      { name: 'is_paid', type: 'BOOLEAN', constraints: 'DEFAULT false' },
      { name: 'payment_method', type: 'payment_method', constraints: '' },
      { name: 'payment_date', type: 'TIMESTAMPTZ', constraints: '' },
      { name: 'started_at', type: 'TIMESTAMPTZ', constraints: '' },
      { name: 'finished_at', type: 'TIMESTAMPTZ', constraints: '' },
      { name: 'cancelled_at', type: 'TIMESTAMPTZ', constraints: '' },
      { name: 'cancellation_reason', type: 'TEXT', constraints: '' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
  },
  {
    id: 'trip_children',
    name: 'trip_children',
    description: 'Crianças associadas a uma viagem, com indicação de necessidade de cadeirinha.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'trip_id', type: 'UUID', constraints: 'FK → trips, ON DELETE CASCADE, NOT NULL' },
      { name: 'age', type: 'INTEGER', constraints: 'NOT NULL' },
      { name: 'needs_car_seat', type: 'BOOLEAN', constraints: 'DEFAULT false' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
  },
  {
    id: 'trip_luggage',
    name: 'trip_luggage',
    description: 'Bagagens associadas a uma viagem, com tamanho e quantidade.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'trip_id', type: 'UUID', constraints: 'FK → trips, ON DELETE CASCADE, NOT NULL' },
      { name: 'size', type: 'luggage_size', constraints: 'NOT NULL' },
      { name: 'quantity', type: 'INTEGER', constraints: 'DEFAULT 1' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
  },
  {
    id: 'trip_status_history',
    name: 'trip_status_history',
    description: 'Histórico de mudanças de status das viagens. Preenchido automaticamente via trigger.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'trip_id', type: 'UUID', constraints: 'FK → trips, ON DELETE CASCADE, NOT NULL' },
      { name: 'from_status', type: 'VARCHAR(50)', constraints: '' },
      { name: 'to_status', type: 'VARCHAR(50)', constraints: 'NOT NULL' },
      { name: 'changed_by', type: 'UUID', constraints: 'FK → users, NOT NULL' },
      { name: 'observations', type: 'TEXT', constraints: '' },
      { name: 'metadata', type: 'JSONB', constraints: '' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
    notes: ['Registros são criados automaticamente via trigger ao alterar trips.status.'],
  },
  {
    id: 'service_requests',
    name: 'service_requests',
    description: 'Solicitações de serviços gerais (não viagens). Inclui descrição, status e pagamento.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'client_id', type: 'UUID', constraints: 'FK → users, NOT NULL' },
      { name: 'provider_profile_id', type: 'UUID', constraints: 'FK → provider_profiles' },
      { name: 'service_category_id', type: 'UUID', constraints: 'FK → service_categories, NOT NULL' },
      { name: 'service_date', type: 'TIMESTAMPTZ', constraints: 'NOT NULL' },
      { name: 'description', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'status', type: 'service_request_status', constraints: 'DEFAULT \'open\'' },
      { name: 'address_id', type: 'UUID', constraints: 'FK → addresses' },
      { name: 'estimated_price', type: 'DECIMAL(10,2)', constraints: '' },
      { name: 'final_price', type: 'DECIMAL(10,2)', constraints: '' },
      { name: 'is_paid', type: 'BOOLEAN', constraints: 'DEFAULT false' },
      { name: 'payment_method', type: 'payment_method', constraints: '' },
      { name: 'observations', type: 'TEXT', constraints: '' },
      { name: 'provider_observations', type: 'TEXT', constraints: '' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
  },
  {
    id: 'service_request_status_history',
    name: 'service_request_status_history',
    description: 'Histórico de mudanças de status das solicitações de serviço. Preenchido automaticamente via trigger.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'service_request_id', type: 'UUID', constraints: 'FK → service_requests, ON DELETE CASCADE, NOT NULL' },
      { name: 'from_status', type: 'VARCHAR(50)', constraints: '' },
      { name: 'to_status', type: 'VARCHAR(50)', constraints: 'NOT NULL' },
      { name: 'changed_by', type: 'UUID', constraints: 'FK → users, NOT NULL' },
      { name: 'observations', type: 'TEXT', constraints: '' },
      { name: 'metadata', type: 'JSONB', constraints: '' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
    notes: ['Registros são criados automaticamente via trigger ao alterar service_requests.status.'],
  },
  {
    id: 'chat_rooms',
    name: 'chat_rooms',
    description: 'Salas de chat entre cliente e prestador, vinculadas a uma viagem ou solicitação de serviço.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'trip_id', type: 'UUID', constraints: 'FK → trips' },
      { name: 'service_request_id', type: 'UUID', constraints: 'FK → service_requests' },
      { name: 'client_id', type: 'UUID', constraints: 'FK → users, NOT NULL' },
      { name: 'provider_id', type: 'UUID', constraints: 'FK → users, NOT NULL' },
      { name: 'is_active', type: 'BOOLEAN', constraints: 'DEFAULT true' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
    notes: ['CHECK: exatamente um entre trip_id e service_request_id deve ser NOT NULL.'],
  },
  {
    id: 'chat_messages',
    name: 'chat_messages',
    description: 'Mensagens enviadas nas salas de chat. Habilitada para Realtime.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'chat_room_id', type: 'UUID', constraints: 'FK → chat_rooms, ON DELETE CASCADE, NOT NULL' },
      { name: 'sender_id', type: 'UUID', constraints: 'FK → users, NOT NULL' },
      { name: 'message', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'message_type', type: 'message_type', constraints: 'DEFAULT \'text\'' },
      { name: 'attachment_url', type: 'TEXT', constraints: '' },
      { name: 'is_read', type: 'BOOLEAN', constraints: 'DEFAULT false' },
      { name: 'read_at', type: 'TIMESTAMPTZ', constraints: '' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
  },
  {
    id: 'notifications',
    name: 'notifications',
    description: 'Notificações do sistema para os usuários. Habilitada para Realtime.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'user_id', type: 'UUID', constraints: 'FK → users, NOT NULL' },
      { name: 'title', type: 'VARCHAR(255)', constraints: 'NOT NULL' },
      { name: 'body', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'type', type: 'VARCHAR(50)', constraints: 'NOT NULL' },
      { name: 'reference_type', type: 'VARCHAR(50)', constraints: '' },
      { name: 'reference_id', type: 'UUID', constraints: '' },
      { name: 'link', type: 'TEXT', constraints: '' },
      { name: 'is_read', type: 'BOOLEAN', constraints: 'DEFAULT false' },
      { name: 'read_at', type: 'TIMESTAMPTZ', constraints: '' },
      { name: 'is_pushed', type: 'BOOLEAN', constraints: 'DEFAULT false' },
      { name: 'pushed_at', type: 'TIMESTAMPTZ', constraints: '' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
  },
  {
    id: 'user_devices',
    name: 'user_devices',
    description: 'Dispositivos registrados dos usuários para push notifications.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'user_id', type: 'UUID', constraints: 'FK → users, NOT NULL' },
      { name: 'device_token', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'platform', type: 'platform_type', constraints: 'NOT NULL' },
      { name: 'is_active', type: 'BOOLEAN', constraints: 'DEFAULT true' },
      { name: 'last_used_at', type: 'TIMESTAMPTZ', constraints: '' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
    notes: ['UNIQUE (user_id, device_token)'],
  },
  {
    id: 'driver_locations',
    name: 'driver_locations',
    description: 'Localização em tempo real dos motoristas. Habilitada para Realtime. O campo location é auto-populado via trigger.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'driver_profile_id', type: 'UUID', constraints: 'FK → driver_profiles, UNIQUE, NOT NULL' },
      { name: 'trip_id', type: 'UUID', constraints: 'FK → trips' },
      { name: 'latitude', type: 'DECIMAL(10,7)', constraints: 'NOT NULL' },
      { name: 'longitude', type: 'DECIMAL(10,7)', constraints: 'NOT NULL' },
      { name: 'location', type: 'GEOGRAPHY(Point,4326)', constraints: 'Auto-populado via trigger' },
      { name: 'heading', type: 'DECIMAL(5,2)', constraints: '' },
      { name: 'speed', type: 'DECIMAL(6,2)', constraints: '' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
  },
  {
    id: 'private_comments',
    name: 'private_comments',
    description: 'Comentários internos/privados sobre entidades do sistema, visíveis apenas para administradores.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'author_id', type: 'UUID', constraints: 'FK → users, NOT NULL' },
      { name: 'reference_type', type: 'VARCHAR(50)', constraints: 'NOT NULL' },
      { name: 'reference_id', type: 'UUID', constraints: '' },
      { name: 'comment', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'admin_response', type: 'TEXT', constraints: '' },
      { name: 'responded_by', type: 'UUID', constraints: 'FK → users' },
      { name: 'responded_at', type: 'TIMESTAMPTZ', constraints: '' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
  },
  {
    id: 'ratings',
    name: 'ratings',
    description: 'Avaliações de viagens e serviços. Trigger recalcula a média do prestador automaticamente.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'trip_id', type: 'UUID', constraints: 'FK → trips' },
      { name: 'service_request_id', type: 'UUID', constraints: 'FK → service_requests' },
      { name: 'rater_id', type: 'UUID', constraints: 'FK → users, NOT NULL' },
      { name: 'rated_id', type: 'UUID', constraints: 'FK → users, NOT NULL' },
      { name: 'rating', type: 'DECIMAL(2,1)', constraints: 'NOT NULL, CHECK (1 a 5)' },
      { name: 'comment', type: 'TEXT', constraints: '' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
    notes: [
      'CHECK: exatamente um entre trip_id e service_request_id deve ser NOT NULL.',
      'Trigger: recalcula average_rating e total_ratings do provider_profiles.',
    ],
  },
  {
    id: 'provider_category_services',
    name: 'provider_category_services',
    description: 'Relacionamento N:N entre prestadores e categorias de serviço adicionais.',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'provider_profile_id', type: 'UUID', constraints: 'FK → provider_profiles, ON DELETE CASCADE, NOT NULL' },
      { name: 'service_category_id', type: 'UUID', constraints: 'FK → service_categories, NOT NULL' },
      { name: 'is_primary', type: 'BOOLEAN', constraints: 'DEFAULT false' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
    notes: ['UNIQUE (provider_profile_id, service_category_id)'],
  },
  {
    id: 'system_settings',
    name: 'system_settings',
    description: 'Configurações globais do sistema em formato chave-valor (JSONB).',
    columns: [
      { name: 'id', type: 'UUID', constraints: 'PK' },
      { name: 'key', type: 'VARCHAR(100)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'value', type: 'JSONB', constraints: 'NOT NULL' },
      { name: 'description', type: 'TEXT', constraints: '' },
      { name: 'updated_by', type: 'UUID', constraints: 'FK → users' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT now()' },
    ],
  },
]

const triggers = [
  {
    name: 'set_address_location',
    table: 'addresses',
    description: 'Preenche automaticamente o campo location (GEOGRAPHY) a partir de latitude e longitude ao inserir ou atualizar um endereço.',
  },
  {
    name: 'set_driver_location',
    table: 'driver_locations',
    description: 'Preenche automaticamente o campo location (GEOGRAPHY) a partir de latitude e longitude ao inserir ou atualizar a localização do motorista.',
  },
  {
    name: 'log_trip_status_change',
    table: 'trips',
    description: 'Ao alterar o campo status de uma viagem, cria automaticamente um registro em trip_status_history com o status anterior e o novo.',
  },
  {
    name: 'log_service_request_status_change',
    table: 'service_requests',
    description: 'Ao alterar o campo status de uma solicitação de serviço, cria automaticamente um registro em service_request_status_history.',
  },
  {
    name: 'recalculate_provider_rating',
    table: 'ratings',
    description: 'Ao inserir uma nova avaliação, recalcula automaticamente os campos average_rating e total_ratings do provider_profiles correspondente.',
  },
  {
    name: 'update_updated_at_column',
    table: 'Várias tabelas',
    description: 'Atualiza automaticamente o campo updated_at com o timestamp atual ao modificar qualquer linha nas tabelas que possuem esse campo.',
  },
]

function TableSection({ table }: { table: TableDoc }) {
  return (
    <section id={table.id} className="scroll-mt-20">
      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1 font-mono">
        {table.name}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">{table.description}</p>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-300 w-1/4">
                Coluna
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-300 w-1/4">
                Tipo
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-300 w-1/2">
                Restrições / Notas
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {table.columns.map((col) => (
              <tr key={col.name} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                <td className="px-4 py-2 font-mono text-sm text-indigo-700 dark:text-indigo-400">
                  {col.name}
                </td>
                <td className="px-4 py-2 font-mono text-sm text-gray-600 dark:text-gray-400">
                  {col.type}
                </td>
                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-500">
                  {col.constraints || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.notes && table.notes.length > 0 && (
        <div className="mb-6 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300">
          {table.notes.map((note, i) => (
            <p key={i} className={i > 0 ? 'mt-1' : ''}>
              ⚠ {note}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}

export default function DocumentacaoDaApiPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-[90rem] mx-auto flex">
        {/* Sidebar */}
        <nav className="hidden lg:block w-72 shrink-0 sticky top-0 h-screen overflow-y-auto border-r border-gray-200 dark:border-gray-800 px-6 py-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">
            Sumário
          </h2>

          <div className="mb-6">
            <a
              href="#enums"
              className="block text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-1"
            >
              Enums
            </a>
          </div>

          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
              Tabelas
            </p>
            <ul className="space-y-0.5">
              {tables.map((t) => (
                <li key={t.id}>
                  <a
                    href={`#${t.id}`}
                    className="block text-sm font-mono text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-0.5 truncate"
                  >
                    {t.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1">
            <a
              href="#triggers"
              className="block text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-1"
            >
              Triggers e Funções
            </a>
            <a
              href="#rls"
              className="block text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-1"
            >
              Políticas RLS
            </a>
            <a
              href="#realtime"
              className="block text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-1"
            >
              Realtime
            </a>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 md:px-12 py-10">
          <header className="mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-50 mb-3">
              Documentação do Banco de Dados
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl">
              Referência completa do schema do banco de dados Supabase (PostgreSQL) do{' '}
              <strong>KZ Serviços</strong>. Inclui tabelas, colunas, tipos, enums,
              relacionamentos, triggers, políticas RLS e configurações de Realtime.
            </p>
          </header>

          {/* Enums Section */}
          <section id="enums" className="mb-16 scroll-mt-20">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 border-b border-gray-200 dark:border-gray-800 pb-3">
              Enums
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
              Tipos enumerados personalizados utilizados nas colunas do banco de dados.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {enums.map((e) => (
                <div
                  key={e.name}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                >
                  <h3 className="font-mono font-semibold text-sm text-indigo-700 dark:text-indigo-400 mb-2">
                    {e.name}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {e.values.map((v) => (
                      <span
                        key={v}
                        className="inline-block px-2 py-0.5 text-xs font-mono rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tables Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 border-b border-gray-200 dark:border-gray-800 pb-3">
              Tabelas
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 text-sm">
              Todas as tabelas do schema <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">public</code>.
              Chaves primárias são UUID gerados via <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">gen_random_uuid()</code>.
              Campos de timestamp utilizam <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">TIMESTAMPTZ</code> com fuso horário.
            </p>
            <div className="space-y-10">
              {tables.map((t) => (
                <TableSection key={t.id} table={t} />
              ))}
            </div>
          </section>

          {/* Triggers Section */}
          <section id="triggers" className="mb-16 scroll-mt-20">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 border-b border-gray-200 dark:border-gray-800 pb-3">
              Triggers e Funções
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
              O banco utiliza triggers PostgreSQL para automatizar ações como histórico
              de status, cálculo de geolocalização e atualização de médias de avaliação.
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-300">
                      Trigger
                    </th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-300">
                      Tabela
                    </th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-300">
                      Descrição
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {triggers.map((tr) => (
                    <tr key={tr.name} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-2.5 font-mono text-sm text-indigo-700 dark:text-indigo-400">
                        {tr.name}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm text-gray-600 dark:text-gray-400">
                        {tr.table}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-500">
                        {tr.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* RLS Section */}
          <section id="rls" className="mb-16 scroll-mt-20">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 border-b border-gray-200 dark:border-gray-800 pb-3">
              Políticas de Segurança em Nível de Linha (RLS)
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
              Todas as tabelas possuem <strong>Row Level Security (RLS)</strong> habilitado.
              As políticas são baseadas no papel (<code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">user_role</code>)
              do usuário autenticado.
            </p>
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Clientes (<code className="text-xs font-mono px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded text-blue-700 dark:text-blue-400">client</code>)
                </h3>
                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>Podem ler e atualizar o próprio perfil em <strong>users</strong></li>
                  <li>Podem criar viagens e solicitações de serviço</li>
                  <li>Podem visualizar apenas suas próprias viagens, solicitações, notificações e chats</li>
                  <li>Podem criar avaliações para serviços que utilizaram</li>
                  <li>Podem visualizar categorias de serviço ativas e perfis de prestadores aprovados</li>
                </ul>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Prestadores (<code className="text-xs font-mono px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 rounded text-green-700 dark:text-green-400">provider</code>)
                </h3>
                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>Podem ler e atualizar o próprio perfil e perfil de prestador/motorista</li>
                  <li>Podem gerenciar seus veículos e fotos de veículos</li>
                  <li>Podem visualizar viagens e solicitações atribuídas a eles</li>
                  <li>Podem atualizar sua localização em tempo real</li>
                  <li>Podem visualizar e enviar mensagens em seus chats</li>
                  <li>Podem visualizar suas próprias notificações e avaliações recebidas</li>
                </ul>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Administradores (<code className="text-xs font-mono px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 rounded text-red-700 dark:text-red-400">admin</code>)
                </h3>
                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>Acesso completo de leitura e escrita a todas as tabelas</li>
                  <li>Podem aprovar/rejeitar perfis de prestadores</li>
                  <li>Podem gerenciar categorias de serviço e configurações do sistema</li>
                  <li>Podem visualizar e responder comentários privados</li>
                  <li>Podem visualizar todas as viagens, solicitações e avaliações</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Realtime Section */}
          <section id="realtime" className="mb-16 scroll-mt-20">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 border-b border-gray-200 dark:border-gray-800 pb-3">
              Realtime (Publicações)
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
              As seguintes tabelas estão habilitadas para{' '}
              <strong>Supabase Realtime</strong>, permitindo que os clientes recebam
              atualizações em tempo real via WebSockets.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  table: 'driver_locations',
                  desc: 'Rastreamento em tempo real da posição dos motoristas durante viagens.',
                },
                {
                  table: 'chat_messages',
                  desc: 'Mensagens de chat recebidas instantaneamente pelos participantes da conversa.',
                },
                {
                  table: 'notifications',
                  desc: 'Notificações entregues em tempo real para a interface do usuário.',
                },
              ].map((item) => (
                <div
                  key={item.table}
                  className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-5"
                >
                  <h3 className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                    {item.table}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-gray-200 dark:border-gray-800 pt-6 text-sm text-gray-400 dark:text-gray-600">
            <p>
              KZ Serviços — Documentação do Banco de Dados • Schema PostgreSQL via Supabase
            </p>
          </footer>
        </main>
      </div>
    </div>
  )
}
