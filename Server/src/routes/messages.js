import { Router } from "express"
import { Conversation } from "../models/Conversation.js"
import { verifyFirebaseToken } from "../middleware/verifyFirebaseToken.js"
import { requireRole } from "../middleware/requireRole.js"
import { notifyRole, notifyUser } from "../lib/notify.js"

const router = Router()

router.use(verifyFirebaseToken)

/*
|--------------------------------------------------------------------------
| HELPER
|--------------------------------------------------------------------------
*/

async function getOrCreateOwnConversation(user) {
  let convo = await Conversation.findOne({
    customer: user._id,
  })

  if (!convo) {
    convo = await Conversation.create({
      customer: user._id,

      customerName:
        user.name ||
        user.email,

      customerEmail:
        user.email,

      messages: [],

      unreadForAdmin: false,
      unreadForCustomer: false,

      unreadAdminCount: 0,
      unreadCustomerCount: 0,

      lastMessageAt: new Date(),

      typing: {
        user: null,
        admin: null,
      },
    })
  } else {
    let changed = false

    if (
      user.name &&
      convo.customerName !== user.name
    ) {
      convo.customerName = user.name
      changed = true
    }

    if (
      user.email &&
      convo.customerEmail !== user.email
    ) {
      convo.customerEmail = user.email
      changed = true
    }

    if (
      typeof convo.unreadAdminCount !==
      "number"
    ) {
      convo.unreadAdminCount = 0
      changed = true
    }

    if (
      typeof convo.unreadCustomerCount !==
      "number"
    ) {
      convo.unreadCustomerCount = 0
      changed = true
    }

    if (changed) {
      await convo.save()
    }
  }

  return convo
}

/*
|--------------------------------------------------------------------------
| CUSTOMER
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| GET CUSTOMER'S OWN CONVERSATION
|--------------------------------------------------------------------------
|
| Opening the chat marks admin replies as read.
|
*/

router.get(
  "/mine",
  async (req, res) => {
    try {
      const convo =
        await getOrCreateOwnConversation(
          req.user
        )

      if (
        convo.unreadForCustomer ||
        convo.unreadCustomerCount > 0
      ) {
        convo.unreadForCustomer = false
        convo.unreadCustomerCount = 0

        await convo.save()
      }

      return res.json({
        conversation: convo,
      })
    } catch (error) {
      console.error(
        "GET /messages/mine failed:",
        error
      )

      return res.status(500).json({
        error:
          "Failed to load conversation",
      })
    }
  }
)

/*
|--------------------------------------------------------------------------
| CUSTOMER UNREAD COUNT
|--------------------------------------------------------------------------
|
| Used by the floating chat icon.
|
*/

router.get(
  "/mine/unread",
  async (req, res) => {
    try {
      const convo =
        await Conversation.findOne({
          customer: req.user._id,
        }).select(
          "unreadForCustomer unreadCustomerCount"
        )

      const count = Number(
        convo?.unreadCustomerCount || 0
      )

      return res.json({
        unread: count > 0,
        count,
      })
    } catch (error) {
      console.error(
        "GET /messages/mine/unread failed:",
        error
      )

      return res.status(500).json({
        error:
          "Failed to load unread count",
      })
    }
  }
)

/*
|--------------------------------------------------------------------------
| CUSTOMER SEND MESSAGE
|--------------------------------------------------------------------------
|
| IMPORTANT:
| We store exactly the text received from the frontend.
|
| "Hi" stays "Hi".
| "Hello" stays "Hello".
|
| There is no translation, replacement or default message here.
|
*/

router.post(
  "/mine",
  async (req, res) => {
    try {
      const rawText =
        typeof req.body?.text ===
        "string"
          ? req.body.text
          : ""

      const messageText =
        rawText.trim()

      if (!messageText) {
        return res.status(400).json({
          error:
            "text is required",
        })
      }

      const convo =
        await getOrCreateOwnConversation(
          req.user
        )

      convo.messages.push({
        sender: "user",

        // Store exactly what frontend sent.
        text: messageText,
      })

      convo.lastMessageAt =
        new Date()

      convo.unreadForAdmin = true

      convo.unreadAdminCount =
        Number(
          convo.unreadAdminCount || 0
        ) + 1

      await convo.save()

      const notificationMessage =
        `${convo.customerName}: ${messageText.slice(
          0,
          80
        )}`

      try {
        await Promise.resolve(
          notifyRole("owner", {
            type: "chat_message",

            title:
              "Ny melding fra kunde",

            message:
              notificationMessage,

            link:
              "/dashboard/owner/meldinger",
          })
        )

        await Promise.resolve(
          notifyRole(
            "administrator",
            {
              type: "chat_message",

              title:
                "Ny melding fra kunde",

              message:
                notificationMessage,

              link:
                "/dashboard/admin/meldinger",
            }
          )
        )
      } catch (notificationError) {
        console.error(
          "Chat notification failed:",
          notificationError
        )
      }

      return res
        .status(201)
        .json({
          conversation: convo,

          // Useful for checking what backend received.
          sentMessage:
            messageText,
        })
    } catch (error) {
      console.error(
        "POST /messages/mine failed:",
        error
      )

      return res.status(500).json({
        error:
          "Failed to send message",
      })
    }
  }
)

/*
|--------------------------------------------------------------------------
| CUSTOMER TYPING
|--------------------------------------------------------------------------
*/

router.post(
  "/mine/typing",
  async (req, res) => {
    try {
      const convo =
        await getOrCreateOwnConversation(
          req.user
        )

      await Conversation.updateOne(
        {
          _id: convo._id,
        },
        {
          $set: {
            "typing.user":
              new Date(),
          },
        }
      )

      return res
        .status(204)
        .end()
    } catch (error) {
      console.error(
        "POST /messages/mine/typing failed:",
        error
      )

      return res.status(500).json({
        error:
          "Failed to update typing status",
      })
    }
  }
)

/*
|--------------------------------------------------------------------------
| ADMIN / OWNER UNREAD MESSAGE COUNT
|--------------------------------------------------------------------------
|
| This returns the TOTAL NUMBER OF UNREAD MESSAGES.
|
| Example:
|
| Customer A sends 3 messages
| Customer B sends 2 messages
|
| Result:
| { count: 5 }
|
*/

router.get(
  "/unread-count",

  requireRole([
    "administrator",
    "owner",
  ]),

  async (req, res) => {
    try {
      const result =
        await Conversation.aggregate(
          [
            {
              $group: {
                _id: null,

                count: {
                  $sum: {
                    $ifNull: [
                      "$unreadAdminCount",
                      0,
                    ],
                  },
                },
              },
            },
          ]
        )

      const count = Number(
        result[0]?.count || 0
      )

      return res.json({
        count,
      })
    } catch (error) {
      console.error(
        "GET /messages/unread-count failed:",
        error
      )

      return res.status(500).json({
        error:
          "Failed to load unread count",
      })
    }
  }
)

/*
|--------------------------------------------------------------------------
| ADMIN / OWNER CONVERSATION LIST
|--------------------------------------------------------------------------
*/

router.get(
  "/",

  requireRole([
    "administrator",
    "owner",
  ]),

  async (req, res) => {
    try {
      const conversations =
        await Conversation.find()
          .sort({
            lastMessageAt: -1,
          })
          .lean()

      return res.json({
        conversations,
      })
    } catch (error) {
      console.error(
        "GET /messages failed:",
        error
      )

      return res.status(500).json({
        error:
          "Failed to load conversations",
      })
    }
  }
)

/*
|--------------------------------------------------------------------------
| ADMIN / OWNER OPEN CONVERSATION
|--------------------------------------------------------------------------
|
| Opening one conversation clears unread messages only for that thread.
|
*/

router.get(
  "/:id",

  requireRole([
    "administrator",
    "owner",
  ]),

  async (req, res) => {
    try {
      const convo =
        await Conversation.findById(
          req.params.id
        )

      if (!convo) {
        return res.status(404).json({
          error:
            "Conversation not found",
        })
      }

      convo.unreadForAdmin =
        false

      convo.unreadAdminCount = 0

      await convo.save()

      return res.json({
        conversation: convo,
      })
    } catch (error) {
      console.error(
        "GET /messages/:id failed:",
        error
      )

      return res.status(500).json({
        error:
          "Failed to load conversation",
      })
    }
  }
)

/*
|--------------------------------------------------------------------------
| ADMIN / OWNER SEND REPLY
|--------------------------------------------------------------------------
|
| Exact message text is preserved here too.
|
*/

router.post(
  "/:id",

  requireRole([
    "administrator",
    "owner",
  ]),

  async (req, res) => {
    try {
      const rawText =
        typeof req.body?.text ===
        "string"
          ? req.body.text
          : ""

      const messageText =
        rawText.trim()

      if (!messageText) {
        return res.status(400).json({
          error:
            "text is required",
        })
      }

      const convo =
        await Conversation.findById(
          req.params.id
        )

      if (!convo) {
        return res.status(404).json({
          error:
            "Conversation not found",
        })
      }

      convo.messages.push({
        sender: "admin",

        // Exact admin text.
        text: messageText,
      })

      convo.lastMessageAt =
        new Date()

      /*
      Admin has the conversation open,
      so admin unread count stays cleared.
      */

      convo.unreadForAdmin =
        false

      convo.unreadAdminCount = 0

      /*
      Customer now has one more unread reply.
      */

      convo.unreadForCustomer =
        true

      convo.unreadCustomerCount =
        Number(
          convo.unreadCustomerCount ||
            0
        ) + 1

      await convo.save()

      try {
        await Promise.resolve(
          notifyUser(
            convo.customer,
            {
              type: "chat_reply",

              title:
                "Nytt svar fra ProVisuell",

              message:
                messageText.slice(
                  0,
                  80
                ),

              link: "/",
            }
          )
        )
      } catch (notificationError) {
        console.error(
          "Customer notification failed:",
          notificationError
        )
      }

      return res.json({
        conversation: convo,

        sentMessage:
          messageText,
      })
    } catch (error) {
      console.error(
        "POST /messages/:id failed:",
        error
      )

      return res.status(500).json({
        error:
          "Failed to send reply",
      })
    }
  }
)

/*
|--------------------------------------------------------------------------
| ADMIN / OWNER TYPING
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/typing",

  requireRole([
    "administrator",
    "owner",
  ]),

  async (req, res) => {
    try {
      const result =
        await Conversation.updateOne(
          {
            _id: req.params.id,
          },
          {
            $set: {
              "typing.admin":
                new Date(),
            },
          }
        )

      if (
        !result.matchedCount
      ) {
        return res.status(404).json({
          error:
            "Conversation not found",
        })
      }

      return res
        .status(204)
        .end()
    } catch (error) {
      console.error(
        "POST /messages/:id/typing failed:",
        error
      )

      return res.status(500).json({
        error:
          "Failed to update typing status",
      })
    }
  }
)

export default router