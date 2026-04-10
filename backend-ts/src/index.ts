import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {
  consumeWalletAuthChallenge,
  createSessionToken,
  isAdminAddress,
  startWalletAuthChallenge,
  verifySessionToken,
} from './auth';
import {
  AdminAccessRecord,
  DatabaseService,
  JourneyRecord,
  UserRecord,
} from './database';

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(helmet());
app.use(cors());
app.use(express.json());

const sendSuccess = (res: Response, data?: unknown, message = 'OK', statusCode = 200) => {
  const payload: Record<string, unknown> = {
    success: true,
    message,
  };

  if (data !== undefined) {
    payload.data = data;
  }

  return res.status(statusCode).json(payload);
};

const sendError = (res: Response, statusCode: number, message: string) => res.status(statusCode).json({
  success: false,
  message,
  error: message,
});

const parseInteger = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? Math.trunc(next) : fallback;
};

const parseBoolean = (value: unknown, fallback = false) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
};

const getPagination = (req: Request) => ({
  skip: Math.max(0, parseInteger(req.query.skip, 0)),
  limit: Math.max(1, parseInteger(req.query.limit, 100)),
});

type ActorContext = {
  session: {
    uID: number;
    evm: string;
  };
  user: UserRecord;
  adminAccess: AdminAccessRecord;
};

const resolveActor = async (req: Request): Promise<ActorContext | null> => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return null;
  }

  try {
    const session = verifySessionToken(token);
    const user =
      await DatabaseService.getUserById(session.uID) ||
      await DatabaseService.getUserByEvm(session.evm);

    if (!user) {
      return null;
    }

    const adminAccess = await DatabaseService.resolveAdminAccess(user, isAdminAddress(user.EVM));
    return {
      session,
      user,
      adminAccess,
    };
  } catch (error) {
    console.warn('Failed to resolve actor:', error);
    return null;
  }
};

const requireActor = async (req: Request, res: Response) => {
  const actor = await resolveActor(req);
  if (!actor) {
    sendError(res, 401, 'Unauthorized');
    return null;
  }

  return actor;
};

const hasRequiredPermission = (actor: ActorContext, requiredPermission?: string | string[]) => {
  if (!requiredPermission) {
    return true;
  }

  const required = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
  return required.some((permission) => actor.adminAccess.permissions.includes(permission));
};

const requireAdmin = async (req: Request, res: Response, requiredPermission?: string | string[]) => {
  const actor = await requireActor(req, res);
  if (!actor) {
    return null;
  }

  if (!actor.adminAccess.can_access_admin) {
    sendError(res, 403, 'Forbidden');
    return null;
  }

  if (!actor.adminAccess.is_admin && !hasRequiredPermission(actor, requiredPermission)) {
    sendError(res, 403, 'Forbidden');
    return null;
  }

  return actor;
};

const buildUserPayload = async (user: UserRecord) => {
  const asset = await DatabaseService.getUserAsset(user.uID).catch(() => null);
  return {
    ...user,
    points: asset?.points || 0,
    requires_profile_completion: !String(user.bio || '').trim(),
  };
};

const ensureOwnedJourney = (journey: JourneyRecord | null, userID: number) => (
  journey && journey.uID === userID ? journey : null
);

app.get('/', (req, res) => {
  sendSuccess(
    res,
    {
      status: 'ok',
      message: 'Jinli TypeScript Backend',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/api/test/data',
        authChallenge: '/api/auth/challenge',
        authVerify: '/api/auth/verify',
        prizes: '/api/prize/all',
        tasks: '/api/task/all',
        user: '/api/user',
      },
    },
    'Backend ready',
  );
});

app.get('/api/test/data', (req, res) => {
  sendSuccess(
    res,
    {
      status: 'ok',
      message: 'TypeScript backend is running',
      timestamp: new Date().toISOString(),
    },
  );
});

app.post('/api/auth/register', (req, res) => {
  sendError(res, 410, 'Registration has moved to wallet sign-in plus profile completion');
});

app.post('/api/auth/challenge', async (req, res) => {
  try {
    const payload = startWalletAuthChallenge(req.body?.evm_address);
    sendSuccess(res, payload);
  } catch (error) {
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to create auth challenge');
  }
});

app.post('/api/auth/verify', async (req, res) => {
  try {
    const challenge = consumeWalletAuthChallenge(req.body || {});
    const user = await DatabaseService.findOrCreateUserByEvm(challenge.evm);
    const asset = (await DatabaseService.getUserAsset(user.uID)) || (await DatabaseService.upsertAsset(user.uID, 0));
    const token = createSessionToken({
      uID: user.uID,
      evm: user.EVM,
    });

    sendSuccess(res, {
      ...user,
      points: asset.points,
      requires_profile_completion: !String(user.bio || '').trim(),
      token,
      access_token: token,
      token_type: 'bearer',
    });
  } catch (error) {
    sendError(res, 401, error instanceof Error ? error.message : 'Failed to verify auth challenge');
  }
});

app.post('/api/auth/login', async (req, res) => {
  req.url = '/api/auth/verify';
  return app._router.handle(req, res, () => undefined);
});

app.get('/api/brand/all', async (req, res) => {
  try {
    const { skip, limit } = getPagination(req);
    const brands = await DatabaseService.listPrizes(skip, limit);
    sendSuccess(res, brands);
  } catch (error) {
    console.error('Error loading brands:', error);
    sendError(res, 500, 'Failed to load brands');
  }
});

app.get('/api/prize/all', async (req, res) => {
  try {
    const { skip, limit } = getPagination(req);
    const prizes = await DatabaseService.listPrizes(skip, limit);
    sendSuccess(res, prizes);
  } catch (error) {
    console.error('Error loading prizes:', error);
    sendError(res, 500, 'Failed to load prizes');
  }
});

app.get('/api/task/all', async (req, res) => {
  try {
    const { skip, limit } = getPagination(req);
    const tasks = await DatabaseService.listTasks(skip, limit);
    sendSuccess(res, tasks);
  } catch (error) {
    console.error('Error loading tasks:', error);
    sendError(res, 500, 'Failed to load tasks');
  }
});

app.get('/api/task/:tID', async (req, res) => {
  try {
    const tID = parseInteger(req.params.tID);
    if (!tID) {
      return sendError(res, 400, 'Invalid tID');
    }

    const task = await DatabaseService.getTask(tID);
    if (!task) {
      return sendError(res, 404, 'Task not found');
    }

    sendSuccess(res, task);
  } catch (error) {
    console.error('Error loading task detail:', error);
    sendError(res, 500, 'Failed to load task');
  }
});

app.get('/api/prize/:bID', async (req, res) => {
  try {
    const bID = parseInteger(req.params.bID);
    if (!bID) {
      return sendError(res, 400, 'Invalid bID');
    }

    const prize = await DatabaseService.getPrizeById(bID);
    if (!prize) {
      return sendError(res, 404, 'Prize not found');
    }

    sendSuccess(res, prize);
  } catch (error) {
    console.error('Error loading prize detail:', error);
    sendError(res, 500, 'Failed to load prize');
  }
});

app.get('/api/user', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const payload = await buildUserPayload(actor.user);
    sendSuccess(res, payload);
  } catch (error) {
    console.error('Error loading current user:', error);
    sendError(res, 500, 'Failed to load user');
  }
});

app.post('/api/user/profile', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const bio = String(req.body?.bio || '').trim();
  if (!bio) {
    return sendError(res, 400, 'bio is required');
  }

  try {
    const updatedUser = await DatabaseService.updateUserProfile(actor.user.uID, { bio });
    if (!updatedUser) {
      return sendError(res, 404, 'User not found');
    }

    const payload = await buildUserPayload(updatedUser);
    sendSuccess(res, payload, 'Profile updated');
  } catch (error) {
    console.error('Error updating user profile:', error);
    sendError(res, 500, 'Failed to update profile');
  }
});

app.get('/api/user/asset/:uID', async (req, res) => {
  try {
    const uID = parseInteger(req.params.uID);
    if (!uID) {
      return sendError(res, 400, 'Invalid user ID');
    }

    const asset = (await DatabaseService.getUserAsset(uID)) || (await DatabaseService.upsertAsset(uID, 0));
    sendSuccess(res, asset);
  } catch (error) {
    console.error('Get user asset error:', error);
    sendError(res, 500, 'Internal server error');
  }
});

app.get('/api/gift', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const gifts = await DatabaseService.listGiftsByUser(actor.user.uID, skip, limit);
    sendSuccess(res, gifts);
  } catch (error) {
    console.error('Error loading gifts:', error);
    sendError(res, 500, 'Failed to load gift records');
  }
});

app.get('/api/journey', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const journeys = await DatabaseService.listJourneysByUser(actor.user.uID, skip, limit);
    sendSuccess(res, journeys);
  } catch (error) {
    console.error('Error loading journeys:', error);
    sendError(res, 500, 'Failed to load journeys');
  }
});

app.get('/api/journey/:jID', async (req, res) => {
  try {
    const jID = parseInteger(req.params.jID);
    if (!jID) {
      return sendError(res, 400, 'Invalid jID');
    }

    const journey = await DatabaseService.getJourney(jID);
    if (!journey) {
      return sendError(res, 404, 'Journey not found');
    }

    sendSuccess(res, journey);
  } catch (error) {
    console.error('Error loading journey:', error);
    sendError(res, 500, 'Failed to load journey');
  }
});

app.post('/api/journey/:identifier/submit', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const identifier = parseInteger(req.params.identifier);
  const infoInput = String(req.body?.info_input || '').trim();

  if (!identifier) {
    return sendError(res, 400, 'Invalid task or journey id');
  }

  if (!infoInput) {
    return sendError(res, 400, 'info_input is required');
  }

  try {
    let journey = ensureOwnedJourney(await DatabaseService.getJourney(identifier), actor.user.uID);

    if (!journey) {
      const task = await DatabaseService.getTask(identifier);
      if (!task) {
        return sendError(res, 404, 'Task not found');
      }
      journey = await DatabaseService.ensureJourneyForUserTask(actor.user.uID, task.tID);
    }

    const updatedJourney = await DatabaseService.submitJourneyInfo(journey.jID, infoInput);
    if (!updatedJourney) {
      return sendError(res, 404, 'Journey not found');
    }

    sendSuccess(res, updatedJourney, 'Journey submitted');
  } catch (error) {
    console.error('Error submitting journey info:', error);
    sendError(res, 500, 'Failed to submit task info');
  }
});

app.post('/api/journey/claim/:jID', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const jID = parseInteger(req.params.jID);
  if (!jID) {
    return sendError(res, 400, 'Invalid jID');
  }

  try {
    const journey = await DatabaseService.getJourney(jID);
    if (!journey) {
      return sendError(res, 404, 'Journey not found');
    }

    if (journey.uID !== actor.user.uID) {
      return sendError(res, 403, 'Forbidden');
    }

    if (!journey.time_checked) {
      return sendError(res, 400, 'Journey is not verified yet');
    }

    if (journey.time_claimed) {
      const currentAsset = (await DatabaseService.getUserAsset(actor.user.uID)) || (await DatabaseService.upsertAsset(actor.user.uID, 0));
      return sendSuccess(res, {
        ...journey,
        reward_points: journey.points_claimed,
        user_points_total: currentAsset.points,
      });
    }

    const task = await DatabaseService.getTask(journey.tID);
    const rewardPoints = journey.points_claimed || task?.points || 0;
    const updatedJourney = await DatabaseService.claimJourney(jID, rewardPoints);
    const updatedAsset = await DatabaseService.upsertAsset(actor.user.uID, rewardPoints);

    if (!updatedJourney) {
      return sendError(res, 404, 'Journey not found');
    }

    sendSuccess(res, {
      ...updatedJourney,
      reward_points: rewardPoints,
      user_points_total: updatedAsset.points,
    }, 'Journey reward claimed');
  } catch (error) {
    console.error('Error claiming journey reward:', error);
    sendError(res, 500, 'Failed to claim reward');
  }
});

app.get('/api/shard', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const shards = await DatabaseService.listShardHoldingsByUser(actor.user.uID, skip, limit);
    sendSuccess(res, shards);
  } catch (error) {
    console.error('Error loading shard holdings:', error);
    sendError(res, 500, 'Failed to load shard holdings');
  }
});

app.get('/api/shard/transfer', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const transfers = await DatabaseService.listShardTransfersByUser(actor.user.uID, skip, limit);
    sendSuccess(res, transfers);
  } catch (error) {
    console.error('Error loading shard transfers:', error);
    sendError(res, 500, 'Failed to load shard transfers');
  }
});

app.post('/api/shard/redeem', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const bID = parseInteger(req.body?.bID);
  if (!bID) {
    return sendError(res, 400, 'Invalid bID');
  }

  try {
    const gift = await DatabaseService.redeemShardGift(actor.user.uID, bID);
    sendSuccess(res, gift, 'Gift redeemed');
  } catch (error) {
    console.error('Error redeeming gift from shards:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to redeem gift');
  }
});

app.post('/api/chest/:bID/open', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const bID = parseInteger(req.params.bID);
  if (!bID) {
    return sendError(res, 400, 'Invalid bID');
  }

  try {
    const result = await DatabaseService.openFreeShardChest(actor.user.uID, bID);
    sendSuccess(res, result, 'Free shard chest opened');
  } catch (error) {
    console.error('Error opening free shard chest:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to open chest');
  }
});

app.get('/api/order', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const orders = await DatabaseService.listOrdersByUser(actor.user.uID, skip, limit);
    sendSuccess(res, orders);
  } catch (error) {
    console.error('Error loading user orders:', error);
    sendError(res, 500, 'Failed to load user orders');
  }
});

app.post('/api/order', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const order = await DatabaseService.placeOrder({
      uID: actor.user.uID,
      bID: parseInteger(req.body?.bID),
      side: String(req.body?.side || 'buy'),
      price: parseInteger(req.body?.price),
      volume: parseInteger(req.body?.volume),
    });
    sendSuccess(res, order, 'Order created');
  } catch (error) {
    console.error('Error creating order:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to create order');
  }
});

app.delete('/api/order', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const result = await DatabaseService.cancelAllOrders(actor.user.uID);
    sendSuccess(res, result, 'Orders cancelled');
  } catch (error) {
    console.error('Error cancelling orders:', error);
    sendError(res, 500, error instanceof Error ? error.message : 'Failed to cancel orders');
  }
});

app.delete('/api/order/:oID', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const oID = parseInteger(req.params.oID);
  if (!oID) {
    return sendError(res, 400, 'Invalid oID');
  }

  try {
    const result = await DatabaseService.cancelOrder(actor.user.uID, oID);
    sendSuccess(res, result, 'Order cancelled');
  } catch (error) {
    console.error('Error cancelling order:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to cancel order');
  }
});

app.get('/api/market/:bID/orderbook', async (req, res) => {
  const bID = parseInteger(req.params.bID);
  if (!bID) {
    return sendError(res, 400, 'Invalid bID');
  }

  try {
    const rows = await DatabaseService.listOrderBook(bID);
    sendSuccess(res, rows);
  } catch (error) {
    console.error('Error loading order book:', error);
    sendError(res, 500, 'Failed to load order book');
  }
});

app.get('/api/market/:bID/trades', async (req, res) => {
  const bID = parseInteger(req.params.bID);
  if (!bID) {
    return sendError(res, 400, 'Invalid bID');
  }

  try {
    const { skip, limit } = getPagination(req);
    const rows = await DatabaseService.listTradesByBrand(bID, skip, limit);
    sendSuccess(res, rows);
  } catch (error) {
    console.error('Error loading market trades:', error);
    sendError(res, 500, 'Failed to load market trades');
  }
});

app.get('/api/admin/me', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  sendSuccess(res, actor.adminAccess);
});

app.get('/api/admin/settings', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_settings');
  if (!actor) return;

  try {
    const settings = await DatabaseService.getSystemSettings();
    sendSuccess(res, settings);
  } catch (error) {
    console.error('Error loading system settings:', error);
    sendError(res, 500, 'Failed to load system settings');
  }
});

app.post('/api/admin/settings', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_settings');
  if (!actor) return;

  try {
    const settings = await DatabaseService.saveSystemSettings(req.body || {});
    sendSuccess(res, settings, 'System settings saved');
  } catch (error) {
    console.error('Error saving system settings:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to save system settings');
  }
});

app.post('/api/admin/settings/reset', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_settings');
  if (!actor) return;

  try {
    const settings = await DatabaseService.resetSystemSettings();
    sendSuccess(res, settings, 'System settings reset');
  } catch (error) {
    console.error('Error resetting system settings:', error);
    sendError(res, 500, 'Failed to reset system settings');
  }
});

app.get('/api/admin/permissions', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_permissions');
  if (!actor) return;

  try {
    const [groups, users] = await Promise.all([
      DatabaseService.listPermissionGroups(),
      DatabaseService.getAllUsers(0, 1000),
    ]);
    sendSuccess(res, { groups, users });
  } catch (error) {
    console.error('Error loading permission groups:', error);
    sendError(res, 500, 'Failed to load permission groups');
  }
});

app.post('/api/admin/permissions/save', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_permissions');
  if (!actor) return;

  try {
    const group = await DatabaseService.savePermissionGroup({
      id: req.body?.id,
      name: req.body?.name,
      description: req.body?.description,
      permissions: Array.isArray(req.body?.permissions) ? req.body.permissions : [],
      user_ids: Array.isArray(req.body?.user_ids)
        ? req.body.user_ids.map((value: unknown) => parseInteger(value)).filter(Boolean)
        : [],
    });
    sendSuccess(res, group, 'Permission group saved');
  } catch (error) {
    console.error('Error saving permission group:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to save permission group');
  }
});

app.post('/api/admin/permissions/delete', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_permissions');
  if (!actor) return;

  const id = String(req.body?.id || '').trim();
  if (!id) {
    return sendError(res, 400, 'Permission group id is required');
  }

  try {
    const deleted = await DatabaseService.deletePermissionGroup(id);
    if (!deleted) {
      return sendError(res, 404, 'Permission group not found');
    }
    sendSuccess(res, { id }, 'Permission group deleted');
  } catch (error) {
    console.error('Error deleting permission group:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to delete permission group');
  }
});

app.post('/api/admin/user/update', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_users');
  if (!actor) return;

  const uID = parseInteger(req.body?.uID);
  if (!uID) {
    return sendError(res, 400, 'Invalid uID');
  }

  try {
    const user = await DatabaseService.updateUserAdminStatus(uID, parseBoolean(req.body?.is_admin));
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    sendSuccess(res, user, 'User updated');
  } catch (error) {
    console.error('Error updating user:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to update user');
  }
});

app.post('/api/admin/task/create', async (req, res) => {
  const actor = await requireAdmin(req, res, ['manage_tasks', 'publish_tasks']);
  if (!actor) return;

  try {
    const task = await DatabaseService.createTask(req.body || {});
    sendSuccess(res, task, 'Task created');
  } catch (error) {
    console.error('Error creating task:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to create task');
  }
});

app.post('/api/admin/task/update', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_tasks');
  if (!actor) return;

  const tID = parseInteger(req.body?.tID);
  if (!tID) {
    return sendError(res, 400, 'Invalid tID');
  }

  try {
    const task = await DatabaseService.updateTask(tID, req.body || {});
    if (!task) {
      return sendError(res, 404, 'Task not found');
    }
    sendSuccess(res, task, 'Task updated');
  } catch (error) {
    console.error('Error updating task:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to update task');
  }
});

app.post('/api/admin/task/delete', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_tasks');
  if (!actor) return;

  const tID = parseInteger(req.body?.tID);
  if (!tID) {
    return sendError(res, 400, 'Invalid tID');
  }

  try {
    await DatabaseService.deleteTask(tID);
    sendSuccess(res, { tID }, 'Task deleted');
  } catch (error) {
    console.error('Error deleting task:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to delete task');
  }
});

app.post('/api/admin/brand/create', async (req, res) => {
  const actor = await requireAdmin(req, res, ['manage_rewards', 'publish_prizes']);
  if (!actor) return;

  try {
    const brand = await DatabaseService.createBrand(req.body || {});
    sendSuccess(res, brand, 'Prize created');
  } catch (error) {
    console.error('Error creating prize:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to create prize');
  }
});

app.post('/api/admin/brand/update', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_rewards');
  if (!actor) return;

  const bID = parseInteger(req.body?.bID);
  if (!bID) {
    return sendError(res, 400, 'Invalid bID');
  }

  try {
    const brand = await DatabaseService.updateBrand(bID, req.body || {});
    if (!brand) {
      return sendError(res, 404, 'Prize not found');
    }
    sendSuccess(res, brand, 'Prize updated');
  } catch (error) {
    console.error('Error updating prize:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to update prize');
  }
});

app.post('/api/admin/brand/delete', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_rewards');
  if (!actor) return;

  const bID = parseInteger(req.body?.bID);
  if (!bID) {
    return sendError(res, 400, 'Invalid bID');
  }

  try {
    await DatabaseService.deleteBrand(bID);
    sendSuccess(res, { bID }, 'Prize deleted');
  } catch (error) {
    console.error('Error deleting prize:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to delete prize');
  }
});

app.post('/api/admin/prize/create', async (req, res) => {
  req.url = '/api/admin/brand/create';
  return app._router.handle(req, res, () => undefined);
});

app.post('/api/admin/prize/update', async (req, res) => {
  req.url = '/api/admin/brand/update';
  return app._router.handle(req, res, () => undefined);
});

app.post('/api/admin/prize/delete', async (req, res) => {
  req.url = '/api/admin/brand/delete';
  return app._router.handle(req, res, () => undefined);
});

app.get('/api/user/all', async (req, res) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const users = await DatabaseService.getAllUsers(skip, limit);
    sendSuccess(res, users);
  } catch (error) {
    console.error('Error loading user list:', error);
    sendError(res, 500, 'Failed to load users');
  }
});

app.get('/api/user/stats', async (req, res) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  try {
    const stats = await DatabaseService.getUserStats();
    sendSuccess(res, stats);
  } catch (error) {
    console.error('Error loading user stats:', error);
    sendError(res, 500, 'Failed to load user stats');
  }
});

app.get('/api/tasklist/pending-verification/count', async (req, res) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  try {
    const count = await DatabaseService.countPendingVerification();
    sendSuccess(res, { count });
  } catch (error) {
    console.error('Error counting pending verification items:', error);
    sendError(res, 500, 'Failed to load pending verification count');
  }
});

app.get('/api/tasklist/pending-verification', async (req, res) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const items = await DatabaseService.listPendingVerification(skip, limit);
    sendSuccess(res, items);
  } catch (error) {
    console.error('Error loading pending verification items:', error);
    sendError(res, 500, 'Failed to load pending verification items');
  }
});

app.post('/api/tasklist/:jID/verify', async (req, res) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  const jID = parseInteger(req.params.jID);
  const approved = req.body?.approved !== false;

  if (!jID) {
    return sendError(res, 400, 'Invalid jID');
  }

  try {
    const journey = await DatabaseService.getJourney(jID);
    if (!journey) {
      return sendError(res, 404, 'Journey not found');
    }

    if (approved) {
      const updated = await DatabaseService.markJourneyChecked(jID);
      if (!updated) {
        return sendError(res, 404, 'Journey not found');
      }
      const [task, user] = await Promise.all([
        DatabaseService.getTask(updated.tID),
        DatabaseService.getUserById(updated.uID),
      ]);
      return sendSuccess(res, {
        ...updated,
        task,
        user: user
          ? {
              uID: user.uID,
              EVM: user.EVM,
              is_admin: user.is_admin,
            }
          : null,
      }, 'Journey verified');
    }

    const updated = await DatabaseService.rejectPendingJourney(jID);
    if (!updated) {
      return sendError(res, 404, 'Journey not found');
    }

    return sendSuccess(res, updated, 'Journey rejected');
  } catch (error) {
    console.error('Error verifying journey:', error);
    sendError(res, 500, 'Failed to verify journey');
  }
});

app.post('/api/admin/assets/init', async (req, res) => {
  try {
    const result = await DatabaseService.initializeAllAssets();
    sendSuccess(res, result, `Initialized ${result.initialized} asset records`);
  } catch (error) {
    console.error('Asset initialization error:', error);
    sendError(res, 500, 'Failed to initialize assets');
  }
});

app.post('/api/admin/points/adjust', async (req, res) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  try {
    const uID = parseInteger(req.body?.uID);
    const amount = parseInteger(req.body?.amount, Number.NaN);
    const reason = String(req.body?.reason || '').trim();

    if (!uID || Number.isNaN(amount) || !reason) {
      return sendError(res, 400, '参数不完整');
    }

    const result = await DatabaseService.adjustPoints(uID, amount, reason);
    if (!result.success) {
      return sendError(res, 404, result.message);
    }

    sendSuccess(res, {
      uID,
      new_points: result.asset?.points || 0,
      timestamp: result.asset?.time_update || Math.floor(Date.now() / 1000),
      reason,
    }, result.message);
  } catch (error) {
    console.error('Points adjustment error:', error);
    sendError(res, 500, '积分调整失败');
  }
});

app.use((req, res) => {
  sendError(res, 404, 'Not found');
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`TypeScript backend running on port ${PORT}`);
    console.log('Using Neon PostgreSQL for Jinli API routes');
  });
}

export default app;
