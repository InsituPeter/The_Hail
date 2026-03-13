const nodemailer= require('nodemailer')


/*async function createEtherealAccount(){
    const testAcount = await nodemailer.createTestAccount()

    console.log("Here are your Ethereal account credentials:")
    console.log(`Email: ${testAcount.user}`)
    console.log(`Password: ${testAcount.pass}`)
    console.log(`SMTP Host: ${testAcount.smtp.host}`)
    console.log(`Secure: ${testAcount.smtp.secure}`)


    return testAcount
}

createEtherealAccount()*/


async function sendTestEmail(){
    const testAccount= await nodemailer.createTestAccount()
    const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass
        } 

    })


}

module.exports={sendTestEmail}