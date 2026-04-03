class EmailService{
    constructor(transporter, templateDomain, frontendUrl){
        this.transporter=transporter
        this.templateDomain=templateDomain
        this.frontendUrl=frontendUrl
    }

async verifyConnection(){
    try{
        await this.transporter.verify()
        console.log(`Email transporter is ready to send messages.`)
        return true
    }

    catch(error){
     console.error(`Error verifying email transporter: ${error.message}`)
     return false
    }
}

async sendEmail(options){
    const info = await this.transporter.sendMail({
        from:options.from,
        to:options.to,
        subject:options.subject,
        html:options.html,
        attachments:options.attachments
    })
    console.log(`Email sent successfully: ${info.messageId}`)
    return info
}

async sendWelcomeEmail(userEmail, userName){
    try{
        const dashboardUrl= `${this.frontendUrl}/dashboard`
        const html= this.templateDomain.renderWelcomeEmail({
            userName,
            dashboardUrl
        })
        return await this.sendEmail({
            to:userEmail,
            subject:`Welcome to ${this.templateDomain.companyName}!`,
            html
        })
    }
    catch(error){
       console.error('Failed to send welcome email:', error.message )
    }
}
async sendPasswordResetEmail(userEmail, userName, resetToken){
     //const resetToken=crypto.randomBytes(32).toString('hex')
     const resetUrl=`${this.frontendUrl}/reset-password?token=${resetToken}`
     const html=this.templateDomain.renderPasswordReset({
        userName,
        resetUrl,
        expirationTime: '1 hour'
     })

     return await this.sendEmail({
        to:userEmail,
        subject:`Password Reset Request for ${this.templateDomain.companyName}`,
        html
     })
}


async sendEmailVerification(userEmail, userName, rawToken){
      const verificationUrl=`${this.frontendUrl}/verify-email?token=${rawToken}`
      const html = this.templateDomain.renderEmailVerification({
        userName,
        verificationUrl
      })
      return await this.sendEmail({
        to: userEmail,
        subject: `Verify your email - ${this.templateDomain.companyName}`,
        html
      })
}


}

module.exports=EmailService 
