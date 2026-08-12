// @vitest-environment node
/**
 * Drift guard for the mirrored subuser permission constants.
 *
 * The Nitro tab routes (web/server/utils/server-tabs.ts) mirror
 * PERMISSION_LABELS (src/modules/user/server/subusers.ts) and
 * PERMISSION_GROUPS (src/handlers/utils/auth/serverAuthUtil.ts) instead of
 * importing them — importing the sources would drag nodemailer / Express
 * request types into the Nitro bundle. This test pins the mirrors to the
 * Express sources so a permission change in Express fails CI until the
 * mirror is updated. Test files may import root modules freely.
 */
import { describe, expect, it } from 'vitest'
import {
  PERMISSION_GROUPS as EXPRESS_PERMISSION_GROUPS,
} from '../../../src/handlers/utils/auth/serverAuthUtil'
import { PERMISSION_LABELS as EXPRESS_PERMISSION_LABELS } from '../../../src/modules/user/server/subusers'
import {
  PERMISSION_GROUPS as NITRO_PERMISSION_GROUPS,
  PERMISSION_LABELS as NITRO_PERMISSION_LABELS,
} from '../../server/utils/server-tabs'

describe('mirrored permission constants stay in sync with the Express sources', () => {
  it('PERMISSION_LABELS matches the Express source exactly', () => {
    expect(NITRO_PERMISSION_LABELS).toEqual(EXPRESS_PERMISSION_LABELS)
  })

  it('PERMISSION_GROUPS matches the Express source exactly', () => {
    expect(NITRO_PERMISSION_GROUPS).toEqual(EXPRESS_PERMISSION_GROUPS)
  })
})
