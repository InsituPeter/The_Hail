class EmailService{
    constructor(transporter, templateDomain, config){
        this.transporter=transporter
        this.templateDomain=templateDomain
        this.config=config
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
    try{
      const info= await this.transporter.sendMail({
        from:options.from,
        to:options.to,
        subject:options.subject,
        html:options.html,
        attachments:options.attachments
      })
      console.log(`Email sent successfully: ${info.messageId}`)
      return info
    }

    catch(error){
        console.log(`Error sending email: ${error.message}`)
    }
}

async sendWelcomeEmail(userEmail, userName){
    try{
        const dashboardUrl= `${this.config.frontend.url}/dashboard`
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
    try{
     //const resetToken=crypto.randomBytes(32).toString('hex')
     const resetUrl=`${this.config.frontend.url}/reset-password?token=${resetToken}`
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
    catch(error){
        console.error('Failed to send password reset email:', error.message )
    }

}


async sendEmailVerification(userEmail, userName, rawToken){
    try{
      const verificationUrl=`${this.config.frontend.url}/verify-email?token=${rawToken}`
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
    catch(error){
        console.error('Failed to send email verification:', error.message )
    }
}


}

module.exports=EmailService 
