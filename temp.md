[921]

| Name             | Type          | Description  |
| --------         | -----------   | -----------  |
| Size             | uint32        | The size of the payload. |
| Payload Type     | uint32        | Set to <strong>8</strong> to denote an <i>Indexation payload</i>. |
| Version          | uint8         | The version of the payload. |
| Index            | ByteArray     | The index key of the message. |
| Data             | ByteArray     | Data we are attaching.    |

**Table 2.3.11:** Indexations payload.