const mongoose = require("mongoose");

const appSettingSchema = new mongoose.Schema(
{
    notificationEnabled:{
        type:Boolean,
        default:true
    },

    freeNotificationDays:{
        type:Number,
        default:7
    }
},
{
    timestamps:true
});

module.exports = mongoose.model("AppSetting", appSettingSchema);