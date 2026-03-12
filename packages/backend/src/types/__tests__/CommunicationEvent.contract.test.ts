import type {
  CommunicationEvent as BackendCommunicationEvent,
  CommunicationEventCore as BackendCommunicationEventCore,
  CreateCommunicationEvent as BackendCreateCommunicationEvent,
} from '../CommunicationEvent.js';
import type {
  CommunicationEvent as FrontendCommunicationEvent,
  CreateCommunicationEvent as FrontendCreateCommunicationEvent,
} from '../../../../../apps/ValyntApp/src/types/CommunicationEvent';
import type {
  CommunicationEvent as SharedCommunicationEvent,
  CommunicationEventCore as SharedCommunicationEventCore,
  CreateCommunicationEvent as SharedCreateCommunicationEvent,
} from '@valueos/shared/types/communication-event';

describe('CommunicationEvent shared contract', () => {
  it('keeps backend and frontend communication event contracts identical', () => {
    expectTypeOf<BackendCommunicationEvent>().toEqualTypeOf<FrontendCommunicationEvent>();
    expectTypeOf<BackendCreateCommunicationEvent>().toEqualTypeOf<FrontendCreateCommunicationEvent>();

    expectTypeOf<BackendCommunicationEvent>().toEqualTypeOf<SharedCommunicationEvent>();
    expectTypeOf<BackendCreateCommunicationEvent>().toEqualTypeOf<SharedCreateCommunicationEvent>();
  });

  it('requires tenant identity in create and emitted event shapes', () => {
    type ExpectedTenantBoundCreateShape = SharedCommunicationEventCore & (
      | {
          tenant_id: string;
          organization_id?: string;
        }
      | {
          organization_id: string;
          tenant_id?: string;
        }
    );

    type ExpectedTenantBoundEventShape = ExpectedTenantBoundCreateShape & {
      id: string;
      timestamp: string;
    };

    expectTypeOf<BackendCreateCommunicationEvent>().toEqualTypeOf<ExpectedTenantBoundCreateShape>();
    expectTypeOf<FrontendCreateCommunicationEvent>().toEqualTypeOf<ExpectedTenantBoundCreateShape>();
    expectTypeOf<BackendCommunicationEvent>().toEqualTypeOf<ExpectedTenantBoundEventShape>();
    expectTypeOf<FrontendCommunicationEvent>().toEqualTypeOf<ExpectedTenantBoundEventShape>();

    expectTypeOf<BackendCommunicationEventCore['metadata']>().toEqualTypeOf<
      Record<string, unknown> | undefined
    >();
  });
});
