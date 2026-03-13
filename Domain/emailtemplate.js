class TemplateDomain{
    constructor(appUrl, companyName, supportEmail){
        this.appUrl=appUrl
        this.companyName=companyName
        this.supportEmail=supportEmail
    }

    renderWelcomeEmail(data){
        const {userName, dashboardUrl}=data
         return `
        <!DOCTYPE html>
        <html>
          <head> 
            <meta charset="utf-8">
            <style>
             body{font-famiy:Arial, sans-serif; line-height:1.6; color:#333;}
             .container{max-width:600px; margin:0 auto; padding:20px}
             .button{
               display:inline-block;
               padding:12px 24px;
               background-color:#007bff; 
               color:white;
               text-decoration:none;
               border-radius: 5px
             }
             .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
            </style>
          </head>

           <body>
          <div class="container">
            <h1>Welcome ${userName}!</h1>
            <p>Thank you for joining ${this.companyName}. We're excited to have you on board.</p>
            
            <p>Here's what you can do next:</p>
            <ul>
              <li>Complete your profile</li>
              <li>Explore our features</li>
              <li>Connect with other users</li>
            </ul>
            
            <p>
              <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
            </p>
            
            <div class="footer">
              <p>If you have any questions, contact us at ${this.supportEmail}</p>
              <p>&copy; ${new Date().getFullYear()} ${this.companyName}</p>
            </div>
          </div>
        </body>
        
        
        </html>
        `
        
    }

    renderPasswordReset(data){
        const{userName, resetUrl, expirationTime}=data
           return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background-color: #dc3545; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
            }
            .warning { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Password Reset Request</h2>
            
            <p>Hi ${userName},</p>
            
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            
            <p>
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            
            <div class="warning">
              <strong>Important:</strong> This link will expire in ${expirationTime}.
            </div>
            
            <p>If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            
            <div class="footer">
              <p>For security reasons, this link can only be used once.</p>
              <p>&copy; ${new Date().getFullYear()} ${this.companyName}</p>
            </div>
          </div>
        </body>
      </html>
    `
    }
    renderEmailVerification(data){
        const{userName, verificationUrl}=data
            return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background-color: #28a745; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
            }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Verify Your Email Address</h2>
            
            <p>Hi ${userName},</p>
            
            <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
            
            <p>
              <a href="${verificationUrl}" class="button">Verify Email</a>
            </p>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #007bff;">${verificationUrl}</p>
            
            <div class="footer">
              <p>If you didn't create an account, please ignore this email.</p>
              <p>&copy; ${new Date().getFullYear()} ${this.companyName}</p>
            </div>
          </div>
        </body>
      </html>
    `;
    }


}


module.exports=TemplateDomain