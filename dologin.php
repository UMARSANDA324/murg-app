<?php
session_start();
extract($_POST);
extract($_GET);
    include('assets/mashaAllah/gyada.php');
    $email = mysqli_real_escape_string($con, $_POST['email']);
    $password = mysqli_real_escape_string($con, $_POST['password']);
    $pass = md5($password);
    
    $query = $con->query("SELECT * FROM facility where email='$email' And password='$pass'")or die($con->error);
    
    if($query->num_rows > 0){
        ?><button class="btn btn-default btn-block" id="btn_sign_in"><span class="fa fa-spinner"></span> Verify Please wait...</button><?php 
        $row = $query->fetch_assoc();
        $_SESSION["id"] = $row["id"];
        $_SESSION["email"] = $row["email"];
        $_SESSION["phone"] = $row["phone"];
        $_SESSION["role"] = $row["role"];
        $_SESSION["name"] = $row["name"];
        $_SESSION['facilityID'] = $row["facilityID"];
    
        $_SESSION["address"] = $row["address"];
        $_SESSION["fname"] = $row["fname"];
        $_SESSION["type"] = $row["type"];
      
       
        if($row["status"] == 0){ 
            ?>
            <button class="btn btn-danger btn-block" id="btn_sign_in">Account Suspended Contact System Admin</button><?php
            ?>
            <script>
                $(document).ready(function(){
                    $("#btn_sign_in").prop("disabled", true);
                    $("#username").prop("disabled", true);
                    $("#password").prop("disabled", true);
              
                    var SetInterval = setTimeout(function(){
                        $("#btn_sign_in").html("Rolling back Please wait...");
                        $("#btn_sign_in").addClass("ajax_loader");
                        $("#btn_sign_in").removeClass("btn-danger");
                    }, 3000);
                    var setnterval = setTimeout(function(){
                        $("#btn_sign_in").prop("disabled", false);
                        $("#username").prop("disabled", false);
                         $("#password").prop("disabled", false);
                       
                        $("#btn_sign_in").html("SIGN IN");
                        $("#haqq").removeClass("ajax_loader");
                        $("#btn_sign_in").addClass("btn-primary");
                    }, 5000);
                })
            </script>
        <?php
        }else if($row["status"] == 1){

            if ($row['role'] =='Admin') {
               ?>
                <script>
                    $(document).ready(function(){
                        $("#btn_sign_in").prop("disabled", true);
                        $("#username").prop("disabled", true);
                        $("#password").prop("disabled", true);
                        
                        var setInteva = setTimeout(function(){
                                $("#btn_sign_in").html("Rolling Back Please wait...");
                                $("#btn_sign_in").addClass("#h");
                                $("#btn_sign_in").removeClass("btn-default");
                        }, 5000);
                        var setInteral = setTimeout(function(){
                location = "system";
                }, 5000);
                    })
                </script>
            
            <?php
            }else if ($row['role'] =='Staff'){
             $_SESSION["facilityID"] = $row["facilityID"];
            ?>
            <script>
                $(document).ready(function(){
                    $("#btn_sign_in").prop("disabled", true);
                    $("#username").prop("disabled", true);
                    $("#password").prop("disabled", true);
                    
                    var setInteva = setTimeout(function(){
                            $("#btn_sign_in").html("Rolling Back Please wait...");
                            $("#btn_sign_in").addClass("#h");
                            $("#btn_sign_in").removeClass("btn-default");
                    }, 5000);
                    var setInteral = setTimeout(function(){
            location = "front";
            }, 5000);
                })
            </script>
            <?php
            }else if ($row['role'] =='Sub-admin'){
             $_SESSION["facilityID"] = $row["facilityID"];
            ?>
            <script>
                $(document).ready(function(){
                    $("#btn_sign_in").prop("disabled", true);
                    $("#username").prop("disabled", true);
                    $("#password").prop("disabled", true);
                    
                    var setInteva = setTimeout(function(){
                            $("#btn_sign_in").html("Rolling Back Please wait...");
                            $("#btn_sign_in").addClass("#h");
                            $("#btn_sign_in").removeClass("btn-default");
                    }, 5000);
                    var setInteral = setTimeout(function(){
            location = "sub";
            }, 5000);
                })
            </script>
            <?php
            } else {
                ?>
                <button class="btn btn-danger btn-block" id="btn_sign_in">Login Successful but Role Unknown. Contact Admin.</button>
                <script>
                    setTimeout(function(){
                        location.reload();
                    }, 5000);
                </script>
                <?php
            }
        }
        
    }else{
        ?><button class="btn btn-danger btn-block" id="btn_sign_in">Invalid sign-in credentials</button><?php
        ?>
            <script>
                $(document).ready(function(){
                    $("#btn_sign_in").prop("disabled", true);
                    $("#username").prop("disabled", true);
                    $("#password").prop("disabled", true);
              
                    var SetInterval = setTimeout(function(){
                        $("#btn_sign_in").html("Rolling back Please wait...");
                        $("#btn_sign_in").addClass("ajax_loader");
                        $("#btn_sign_in").removeClass("btn-danger");
                    }, 3000);
                    var setnterval = setTimeout(function(){
                        $("#btn_sign_in").prop("disabled", false);
                        $("#username").prop("disabled", false);
                         $("#password").prop("disabled", false);
                       
                        $("#btn_sign_in").html("SIGN IN");
                        $("#haqq").removeClass("ajax_loader");
                        $("#btn_sign_in").addClass("btn-primary");
                    }, 5000);
                })
            </script>
        <?php
    }

?>

